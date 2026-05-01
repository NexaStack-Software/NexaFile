#!/usr/bin/env python3
"""
rechnungen.py – Lädt Rechnungs-PDFs aus einem Gmail-Postfach für einen Zeitraum.

Verwendung:
    python3 rechnungen.py --email du@gmail.com --year 2026 --month 04
    python3 rechnungen.py --email du@gmail.com --from 2026-01-01 --to 2026-12-31
    python3 rechnungen.py --email du@gmail.com --year 2025 --month 12 --output ./archiv
    python3 rechnungen.py --email du@gmail.com --year 2026 --month 04 --verbose
    python3 rechnungen.py --email du@gmail.com --year 2026 --month 04 --quiet

Voraussetzung:
    Gmail App-Passwort (Google-Konto -> Sicherheit -> 2FA -> App-Passwörter).
    Wird interaktiv abgefragt, nicht gespeichert.

Optional Konfiguration:
    ~/.rechnungen.json kann zusätzliche Domains/Keywords enthalten:
    {
        "known_domains": ["weiterer-anbieter.de"],
        "keywords": ["mahngebühr"],
        "ignore_keywords": ["spendenaufruf"],
        "portal_hints": ["bitte einloggen unter"]
    }

Output:
    ./rechnungen/<JAHR>-<MONAT>/
        <absender-domain>/
            <datum>_<betreff-saniert>_<originalname>.pdf
        _gezogen.csv         – alle automatisch gezogenen Rechnungen
        _manuell_ziehen.csv  – Rechnungs-Mails ohne PDF (Portal-Logins etc.)
        _log.txt             – Verarbeitungsprotokoll
        _seen.json           – Cache verarbeiteter Message-IDs (Idempotenz)
"""

from __future__ import annotations

import argparse
import csv
import email
import email.header
import email.utils
import getpass
import imaplib
import io
import json
import logging
import re
import sys
import time
import zipfile
from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import date, datetime
from email.message import Message
from pathlib import Path

# ----------------------------------------------------------------------------
# Konfiguration – hier erweiterbar ohne Code-Logik anzufassen
# ----------------------------------------------------------------------------

IMAP_HOST = "imap.gmail.com"
IMAP_PORT = 993
MAILBOX = "[Gmail]/Alle Nachrichten"
MAILBOX_FALLBACK = "INBOX"
CONFIG_PATH = Path.home() / ".rechnungen.json"
FETCH_RETRIES = 3

# Stichwörter, die auf eine Rechnungs-Mail hindeuten (Betreff oder Body).
RECHNUNG_KEYWORDS: list[str] = [
    "rechnung", "invoice", "beleg", "receipt", "quittung",
    "zahlungsbestätigung", "zahlungsbestaetigung", "payment confirmation",
    "abrechnung", "gutschrift", "kreditnote", "credit note",
    "auftragsbestätigung", "auftragsbestaetigung", "order confirmation",
]

# Absender-Domains, die wir als verlässliche Rechnungs-Quellen kennen.
KNOWN_RECHNUNG_DOMAINS: set[str] = {
    "hetzner.com", "hetzner.de", "netcup.de", "netcup.eu",
    "all-inkl.com", "all-inkl.de", "strato.de", "strato.com",
    "anthropic.com", "openai.com", "cloudflare.com",
    "godaddy.com", "deutschepost.de", "uber.com", "flixbus.de",
    "amazon.de", "amazon.com", "paypal.com", "paypal.de",
    "telekom.de", "vodafone.de", "o2.de", "1und1.de", "ionos.de",
    "premiumsim.de", "congstar.de",
    "stripe.com", "suno.com", "github.com", "gitlab.com",
    "google.com", "microsoft.com", "apple.com",
    "wise.com", "n26.com", "dkb.de", "comdirect.de", "ing.de",
}

# Stichwörter, die eine Mail als Werbung/Newsletter disqualifizieren.
IGNORE_KEYWORDS: list[str] = [
    "newsletter", "unsubscribe", "abmelden",
    "sale", "rabatt", "% off",
]

# Portal-Hinweise: Mail enthält Rechnungs-Indikator, aber kein PDF.
PORTAL_HINTS: list[str] = [
    "im kundenportal", "im kundencenter", "in der servicewelt",
    "in ihrem konto", "im kundenlogin", "in ihrem account",
    "log in to", "anmelden unter", "rechnung abrufen",
    "rechnung steht zum download bereit", "view your invoice",
    "im ccp", "control panel",
]


def load_user_config() -> None:
    """Erweitert globale Listen aus ~/.rechnungen.json (falls vorhanden)."""
    if not CONFIG_PATH.exists():
        return
    try:
        cfg = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        logging.getLogger("rechnungen").warning(
            "Konnte %s nicht lesen: %s", CONFIG_PATH, e
        )
        return
    KNOWN_RECHNUNG_DOMAINS.update(d.lower() for d in cfg.get("known_domains", []))
    RECHNUNG_KEYWORDS.extend(k.lower() for k in cfg.get("keywords", []))
    IGNORE_KEYWORDS.extend(k.lower() for k in cfg.get("ignore_keywords", []))
    PORTAL_HINTS.extend(p.lower() for p in cfg.get("portal_hints", []))


# ----------------------------------------------------------------------------
# Datentypen
# ----------------------------------------------------------------------------

@dataclass
class MailRef:
    """Eine Mail im Verarbeitungskontext."""
    uid: str
    message_id: str
    sender_name: str
    sender_email: str
    sender_domain: str
    subject: str
    date: datetime
    body_text: str
    # tuple: (filename, content, from_zip)
    pdf_attachments: list[tuple[str, bytes, bool]] = field(default_factory=list)


@dataclass(frozen=True)
class GezogeneRechnung:
    sender_domain: str
    sender_email: str
    date: str
    subject: str
    amount: str
    invoice_number: str
    file_path: str
    from_zip: bool


@dataclass(frozen=True)
class ManuelleAufgabe:
    sender_domain: str
    sender_email: str
    date: str
    subject: str
    amount_hint: str
    portal_hint: str
    grund: str


# ----------------------------------------------------------------------------
# Logging
# ----------------------------------------------------------------------------

def setup_logging(out_root: Path, verbose: bool, quiet: bool) -> logging.Logger:
    out_root.mkdir(parents=True, exist_ok=True)
    level = logging.DEBUG if verbose else (logging.WARNING if quiet else logging.INFO)

    log = logging.getLogger("rechnungen")
    log.setLevel(logging.DEBUG)
    log.handlers.clear()  # Doppel-Handler bei wiederholtem Aufruf vermeiden

    fmt = logging.Formatter(
        "%(asctime)s %(levelname)s %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    console = logging.StreamHandler(sys.stdout)
    console.setFormatter(fmt)
    console.setLevel(level)
    log.addHandler(console)

    file_handler = logging.FileHandler(out_root / "_log.txt", encoding="utf-8")
    file_handler.setFormatter(fmt)
    file_handler.setLevel(logging.DEBUG)  # Datei kriegt immer alles
    log.addHandler(file_handler)

    return log


# ----------------------------------------------------------------------------
# CLI
# ----------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Lädt Rechnungs-PDFs aus einem Gmail-Postfach.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument("--email", required=True, help="Gmail-Adresse")
    p.add_argument("--year", type=int, help="Jahr, z.B. 2026")
    p.add_argument("--month", type=int, help="Monat 1-12")
    p.add_argument("--from", dest="date_from", help="Startdatum YYYY-MM-DD")
    p.add_argument("--to", dest="date_to", help="Enddatum YYYY-MM-DD (exklusiv)")
    p.add_argument("--output", default="./rechnungen",
                   help="Ausgabe-Basisverzeichnis (Default: ./rechnungen)")
    p.add_argument("--mailbox", default=MAILBOX,
                   help=f"IMAP-Mailbox (Default: {MAILBOX})")
    verbosity = p.add_mutually_exclusive_group()
    verbosity.add_argument("--verbose", "-v", action="store_true",
                           help="Mehr Log-Output (DEBUG-Level)")
    verbosity.add_argument("--quiet", "-q", action="store_true",
                           help="Nur Warnungen/Fehler auf der Konsole")
    args = p.parse_args()

    if args.date_from or args.date_to:
        if not (args.date_from and args.date_to):
            p.error("--from und --to müssen zusammen verwendet werden.")
        try:
            args._from = datetime.strptime(args.date_from, "%Y-%m-%d").date()
            args._to = datetime.strptime(args.date_to, "%Y-%m-%d").date()
        except ValueError as e:
            p.error(f"Ungültiges Datum: {e}")
        args._label = f"{args.date_from}_bis_{args.date_to}"
    elif args.year and args.month:
        if not (1 <= args.month <= 12):
            p.error("--month muss 1-12 sein.")
        args._from = date(args.year, args.month, 1)
        if args.month == 12:
            args._to = date(args.year + 1, 1, 1)
        else:
            args._to = date(args.year, args.month + 1, 1)
        args._label = f"{args.year}-{args.month:02d}"
    else:
        p.error("Entweder --year und --month, oder --from und --to angeben.")

    return args


# ----------------------------------------------------------------------------
# IMAP
# ----------------------------------------------------------------------------

def connect(email_addr: str, app_password: str, mailbox: str) -> imaplib.IMAP4_SSL:
    conn = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
    conn.login(email_addr, app_password)
    typ, _ = conn.select(f'"{mailbox}"', readonly=True)
    if typ != "OK":
        typ, _ = conn.select(MAILBOX_FALLBACK, readonly=True)
        if typ != "OK":
            raise RuntimeError(
                f"Mailbox nicht öffnenbar: {mailbox} und {MAILBOX_FALLBACK}"
            )
    return conn


def search_uids(conn: imaplib.IMAP4_SSL, date_from: date, date_to: date) -> list[bytes]:
    since = date_from.strftime("%d-%b-%Y")
    before = date_to.strftime("%d-%b-%Y")
    typ, data = conn.uid("SEARCH", None, f"(SINCE {since} BEFORE {before})")
    if typ != "OK":
        raise RuntimeError(f"IMAP SEARCH fehlgeschlagen: {data!r}")
    return data[0].split() if data and data[0] else []


def fetch_mail(conn: imaplib.IMAP4_SSL, uid: bytes) -> Message | None:
    typ, data = conn.uid("FETCH", uid, "(RFC822)")
    if typ != "OK" or not data or not data[0]:
        return None
    raw = data[0][1]
    if not isinstance(raw, (bytes, bytearray)):
        return None
    return email.message_from_bytes(raw)


def fetch_mail_with_retry(
    conn: imaplib.IMAP4_SSL, uid: bytes, log: logging.Logger
) -> Message | None:
    """Fetch mit exponential backoff – Gmail-IMAP timed gelegentlich."""
    last_err: Exception | None = None
    for attempt in range(FETCH_RETRIES):
        try:
            return fetch_mail(conn, uid)
        except (imaplib.IMAP4.error, ConnectionError, OSError) as e:
            last_err = e
            if attempt < FETCH_RETRIES - 1:
                wait = 2 ** attempt
                log.warning("Fetch UID %s fehlgeschlagen (%s), retry in %ds",
                            uid.decode("ascii", "replace"), e, wait)
                time.sleep(wait)
    log.error("Fetch UID %s endgültig fehlgeschlagen: %s",
              uid.decode("ascii", "replace"), last_err)
    return None


# ----------------------------------------------------------------------------
# Mail-Parsing
# ----------------------------------------------------------------------------

def decode_header(value: str | None) -> str:
    if not value:
        return ""
    parts = email.header.decode_header(value)
    out: list[str] = []
    for text, enc in parts:
        if isinstance(text, bytes):
            try:
                out.append(text.decode(enc or "utf-8", errors="replace"))
            except LookupError:
                out.append(text.decode("utf-8", errors="replace"))
        else:
            out.append(text)
    return "".join(out).strip()


def parse_sender(raw_from: str) -> tuple[str, str, str]:
    """Liefert (Anzeigename, Email, Domain)."""
    decoded = decode_header(raw_from)
    name, addr = email.utils.parseaddr(decoded)
    domain = addr.split("@")[-1].lower() if "@" in addr else ""
    return name, addr.lower(), domain


def parse_date(msg: Message) -> datetime:
    raw = msg.get("Date", "")
    try:
        return email.utils.parsedate_to_datetime(raw)
    except (TypeError, ValueError):
        return datetime.now()


def _decode_part_text(part: Message) -> str | None:
    payload = part.get_payload(decode=True)
    if not isinstance(payload, (bytes, bytearray)):
        return None
    charset = part.get_content_charset() or "utf-8"
    try:
        return payload.decode(charset, errors="replace")
    except LookupError:
        return payload.decode("utf-8", errors="replace")


def extract_body_text(msg: Message) -> str:
    """text/plain bevorzugt; HTML-Fallback mit Tag-Strip wenn kein Plaintext da."""
    plain_parts: list[str] = []
    html_parts: list[str] = []

    iterator: Iterable[Message] = msg.walk() if msg.is_multipart() else [msg]
    for part in iterator:
        ctype = part.get_content_type()
        disp = str(part.get("Content-Disposition", ""))
        if "attachment" in disp:
            continue
        if ctype not in ("text/plain", "text/html"):
            continue
        text = _decode_part_text(part)
        if text is None:
            continue
        if ctype == "text/plain":
            plain_parts.append(text)
        else:
            stripped = re.sub(r"<[^>]+>", " ", text)
            stripped = re.sub(r"\s+", " ", stripped)
            html_parts.append(stripped)

    return "\n".join(plain_parts) if plain_parts else "\n".join(html_parts)


def _is_pdf_part(part: Message, filename: str | None) -> bool:
    if part.get_content_type() == "application/pdf":
        return True
    return bool(filename and filename.lower().endswith(".pdf"))


def _is_zip_part(part: Message, filename: str | None) -> bool:
    ctype = part.get_content_type()
    if ctype in ("application/zip", "application/x-zip-compressed"):
        return True
    return bool(filename and filename.lower().endswith(".zip"))


def _extract_pdfs_from_zip(blob: bytes, log: logging.Logger) -> list[tuple[str, bytes]]:
    out: list[tuple[str, bytes]] = []
    try:
        with zipfile.ZipFile(io.BytesIO(blob)) as zf:
            for info in zf.infolist():
                if info.is_dir():
                    continue
                if not info.filename.lower().endswith(".pdf"):
                    continue
                try:
                    out.append((Path(info.filename).name, zf.read(info)))
                except (zipfile.BadZipFile, RuntimeError) as e:
                    log.warning("Konnte PDF in ZIP nicht lesen (%s): %s",
                                info.filename, e)
    except zipfile.BadZipFile as e:
        log.warning("Defektes ZIP-Archiv übersprungen: %s", e)
    return out


def extract_pdfs(msg: Message, log: logging.Logger) -> list[tuple[str, bytes, bool]]:
    """Liefert Liste von (filename, bytes, from_zip)."""
    pdfs: list[tuple[str, bytes, bool]] = []
    if not msg.is_multipart():
        return pdfs
    for part in msg.walk():
        filename = part.get_filename()
        if filename:
            filename = decode_header(filename)
        payload = part.get_payload(decode=True)
        if not isinstance(payload, (bytes, bytearray)):
            continue

        if _is_pdf_part(part, filename):
            pdfs.append((filename or "rechnung.pdf", bytes(payload), False))
        elif _is_zip_part(part, filename):
            for inner_name, inner_blob in _extract_pdfs_from_zip(bytes(payload), log):
                pdfs.append((inner_name, inner_blob, True))
    return pdfs


def build_mail_ref(uid: bytes, msg: Message, log: logging.Logger) -> MailRef:
    name, addr, domain = parse_sender(msg.get("From", ""))
    return MailRef(
        uid=uid.decode("ascii"),
        message_id=(msg.get("Message-ID") or "").strip(),
        sender_name=name,
        sender_email=addr,
        sender_domain=domain,
        subject=decode_header(msg.get("Subject", "")),
        date=parse_date(msg),
        body_text=extract_body_text(msg),
        pdf_attachments=extract_pdfs(msg, log),
    )


# ----------------------------------------------------------------------------
# Klassifikation
# ----------------------------------------------------------------------------

def has_keyword(text: str, keywords: Iterable[str]) -> bool:
    low = text.lower()
    return any(k in low for k in keywords)


def classify(mail: MailRef) -> str:
    """AUTO | MANUAL | IGNORE"""
    haystack = f"{mail.subject}\n{mail.body_text}"

    is_known_sender = any(
        mail.sender_domain == d or mail.sender_domain.endswith("." + d)
        for d in KNOWN_RECHNUNG_DOMAINS
    )
    has_rechnung_kw = has_keyword(haystack, RECHNUNG_KEYWORDS)
    has_ignore_kw = has_keyword(haystack, IGNORE_KEYWORDS)

    # Bekannter Absender ODER Rechnungs-Keyword reicht.
    is_rechnungsmail = is_known_sender or has_rechnung_kw

    if not is_rechnungsmail:
        return "IGNORE"
    if has_ignore_kw and not is_known_sender:
        return "IGNORE"
    if mail.pdf_attachments:
        return "AUTO"
    return "MANUAL"


# ----------------------------------------------------------------------------
# Body-Parsing für Beträge & Rechnungs-Nr.
# ----------------------------------------------------------------------------

# Erkennt sowohl "12,99 €" / "12.99 EUR" als auch "$12.99" / "USD 12.99"
AMOUNT_RX = re.compile(
    r"(?:(?P<cur1>€|EUR|USD|\$)\s*(?P<num1>\d{1,3}(?:[.,\s]\d{3})*[.,]\d{2}))"
    r"|"
    r"(?:(?P<num2>\d{1,3}(?:[.,\s]\d{3})*[.,]\d{2})\s*(?P<cur2>€|EUR|USD|\$))",
    re.IGNORECASE,
)

INVOICE_NR_RX = re.compile(
    r"(?:rechnungs?\s*-?\s*nr\.?|invoice\s*(?:no|number|#)|beleg\s*nr\.?|"
    r"order\s*#?|auftrag\s*\#?)\s*[:#]?\s*"
    r"(?P<nr>[A-Z0-9][A-Z0-9\-_/]{3,30})",
    re.IGNORECASE,
)


def _normalize_currency(cur: str) -> str:
    cur = cur.upper()
    if cur == "$":
        return "USD"
    if cur == "€":
        return "EUR"
    return cur


def extract_amount(text: str) -> str:
    m = AMOUNT_RX.search(text)
    if not m:
        return ""
    num = m.group("num1") or m.group("num2") or ""
    cur = m.group("cur1") or m.group("cur2") or ""
    return f"{num} {_normalize_currency(cur)}".strip()


def extract_invoice_number(text: str) -> str:
    m = INVOICE_NR_RX.search(text)
    return m.group("nr") if m else ""


def detect_portal_hint(text: str) -> str:
    low = text.lower()
    for hint in PORTAL_HINTS:
        if hint in low:
            return hint
    return ""


# ----------------------------------------------------------------------------
# Sanitization
# ----------------------------------------------------------------------------

SAFE_RX = re.compile(r"[^A-Za-z0-9._\-äöüÄÖÜß]+")
CSV_BAD_RX = re.compile(r"[\r\n\t]+")


def sanitize(s: str, maxlen: int = 60) -> str:
    s = SAFE_RX.sub("_", s).strip("_")
    return s[:maxlen] if s else "datei"


def csvsafe(s: str) -> str:
    """Entfernt Zeilenumbrüche/Tabs aus Feldern, die Excel sonst zerlegen würde."""
    return CSV_BAD_RX.sub(" ", s).strip()


# ----------------------------------------------------------------------------
# Hauptlauf
# ----------------------------------------------------------------------------

def run(args: argparse.Namespace) -> int:
    out_root = Path(args.output) / args._label
    log = setup_logging(out_root, verbose=args.verbose, quiet=args.quiet)
    load_user_config()

    seen_path = out_root / "_seen.json"
    if seen_path.exists():
        try:
            seen: set[str] = set(json.loads(seen_path.read_text(encoding="utf-8")))
        except json.JSONDecodeError:
            log.warning("_seen.json defekt – starte mit leerem Cache")
            seen = set()
    else:
        seen = set()

    gezogen: list[GezogeneRechnung] = []
    manuell: list[ManuelleAufgabe] = []

    log.info("Verbinde %s -> %s:%d", args.email, IMAP_HOST, IMAP_PORT)
    password = getpass.getpass("Gmail App-Passwort (Eingabe unsichtbar): ")

    try:
        conn = connect(args.email, password, args.mailbox)
    except imaplib.IMAP4.error as e:
        log.error("Login fehlgeschlagen: %s", e)
        return 2

    try:
        log.info("Suche Mails %s bis %s (exklusiv)", args._from, args._to)
        uids = search_uids(conn, args._from, args._to)
        total = len(uids)
        log.info("%d Mails im Zeitraum gefunden", total)

        for i, uid in enumerate(uids, 1):
            if i % 50 == 0:
                log.info("Progress: %d/%d", i, total)

            msg = fetch_mail_with_retry(conn, uid, log)
            if msg is None:
                continue

            mail = build_mail_ref(uid, msg, log)
            if mail.message_id and mail.message_id in seen:
                log.debug("Skip bereits verarbeitet: %s", mail.message_id)
                continue

            verdict = classify(mail)
            haystack = f"{mail.subject}\n{mail.body_text}"
            amount = extract_amount(haystack)
            invoice_nr = extract_invoice_number(haystack)
            datestr = mail.date.strftime("%Y-%m-%d")

            if verdict == "AUTO":
                target_dir = out_root / sanitize(mail.sender_domain or "unbekannt", 40)
                target_dir.mkdir(parents=True, exist_ok=True)
                for fname, blob, from_zip in mail.pdf_attachments:
                    safe_subject = sanitize(mail.subject, 50)
                    safe_orig = sanitize(fname, 60)
                    out_path = target_dir / f"{datestr}_{safe_subject}_{safe_orig}"
                    if out_path.suffix.lower() != ".pdf":
                        out_path = out_path.with_suffix(".pdf")
                    out_path.write_bytes(blob)
                    gezogen.append(GezogeneRechnung(
                        sender_domain=mail.sender_domain,
                        sender_email=mail.sender_email,
                        date=datestr,
                        subject=mail.subject,
                        amount=amount,
                        invoice_number=invoice_nr,
                        file_path=str(out_path.relative_to(out_root)),
                        from_zip=from_zip,
                    ))
                log.info("AUTO   [%d/%d] %s – %s",
                         i, total, mail.sender_domain, mail.subject[:60])

            elif verdict == "MANUAL":
                manuell.append(ManuelleAufgabe(
                    sender_domain=mail.sender_domain,
                    sender_email=mail.sender_email,
                    date=datestr,
                    subject=mail.subject,
                    amount_hint=amount,
                    portal_hint=detect_portal_hint(haystack),
                    grund="Rechnungs-Mail ohne PDF-Anhang",
                ))
                log.info("MANUAL [%d/%d] %s – %s",
                         i, total, mail.sender_domain, mail.subject[:60])
            else:
                log.debug("IGNORE [%d/%d] %s – %s",
                          i, total, mail.sender_domain, mail.subject[:60])

            if mail.message_id:
                seen.add(mail.message_id)

    finally:
        try:
            conn.close()
            conn.logout()
        except (imaplib.IMAP4.error, OSError):
            pass

    # ----------- Output -----------
    write_csv(
        out_root / "_gezogen.csv",
        ["Absender-Domain", "Absender-Email", "Datum", "Betreff",
         "Betrag", "Rechnungs-Nr", "Datei", "Aus-ZIP"],
        [[csvsafe(g.sender_domain), csvsafe(g.sender_email), g.date,
          csvsafe(g.subject), csvsafe(g.amount), csvsafe(g.invoice_number),
          csvsafe(g.file_path), "ja" if g.from_zip else "nein"]
         for g in gezogen],
    )

    write_csv(
        out_root / "_manuell_ziehen.csv",
        ["Absender-Domain", "Absender-Email", "Datum", "Betreff",
         "Betrag-Hinweis", "Portal-Hinweis", "Grund"],
        [[csvsafe(m.sender_domain), csvsafe(m.sender_email), m.date,
          csvsafe(m.subject), csvsafe(m.amount_hint),
          csvsafe(m.portal_hint), csvsafe(m.grund)]
         for m in manuell],
    )

    seen_path.write_text(
        json.dumps(sorted(seen), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    log.info("--- FERTIG ---")
    log.info("Gezogen:  %d PDFs", len(gezogen))
    log.info("Manuell:  %d Mails ohne PDF", len(manuell))
    log.info("Output:   %s", out_root.resolve())

    return 0


def write_csv(path: Path, header: list[str], rows: list[list[str]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, delimiter=";", quoting=csv.QUOTE_MINIMAL)
        w.writerow(header)
        w.writerows(rows)


if __name__ == "__main__":
    sys.exit(run(parse_args()))
