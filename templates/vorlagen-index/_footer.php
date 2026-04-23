<?php
// SPDX-License-Identifier: AGPL-3.0-or-later
// © 2026 NexaStack, NexaSign contributors. Based on NexaSign (AGPL-3.0).
/**
 * Gemeinsamer Footer für alle NexaSign-Vorlagen-Seiten.
 * Weist auf die Zugehörigkeit zum NexaStack-Projekt hin. Identisch gerendert
 * durch das Remix-Root-Layout (apps/remix/app/root.tsx), damit App-Seiten und
 * Vorlagen-Seiten denselben Abschluss zeigen.
 */
?>
<style>
  /* Sticky-Footer-Pattern: Body zu Flex-Column machen, main wächst, Footer klebt unten.
     Funktioniert für jede einbindende Seite (main-Element vorausgesetzt). */
  body { display: flex; flex-direction: column; min-height: 100vh; }
  main { flex: 1; }
  .nx-footer {
    border-top: 1px solid #e6d8cc;
    background: #fdf9f3;
    margin-top: auto;
  }
  .nx-footer-inner {
    max-width: 1280px;
    margin: 0 auto;
    padding: 1.5rem 2rem;
    text-align: center;
    font-size: 1rem;
    color: #44474d;
  }
  .nx-footer a {
    color: #1c1c18;
    font-weight: 500;
    text-decoration: none;
    transition: color 0.15s;
  }
  .nx-footer a:hover { color: #9e4127; }
</style>
<footer class="nx-footer">
  <div class="nx-footer-inner">
    NexaSign — ein Open-Source-Projekt von <a href="https://nexastack.co/">NexaStack</a>
  </div>
</footer>
