import { useEffect, useMemo, useState } from 'react';

import { XIcon } from 'lucide-react';
import { useLocation } from 'react-router';

import { cn } from '@nexasign/ui/lib/utils';
import { Button } from '@nexasign/ui/primitives/button';

type TourStep = {
  selector: string;
  title: string;
  body: string;
};

type SpotlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const STORAGE_KEY = 'nexasign-demo-tour-v1';

const TOUR_STEPS: TourStep[] = [
  {
    selector: '[data-tour="document-list"]',
    title: 'Deine Dokumentenzentrale',
    body: 'Hier findest du alle Dokumente: Entwürfe, laufende Signaturen und abgeschlossene Vorgänge. In der Demo sind bereits Beispiele vorbereitet.',
  },
  {
    selector: '[data-tour="upload-document"]',
    title: 'Neues Dokument starten',
    body: 'Über diesen Button lädst du ein PDF hoch und startest daraus einen Signaturprozess. Danach setzt du Empfänger und Felder.',
  },
  {
    selector: '[data-tour="document-filters"]',
    title: 'Status, Suche und Zeitraum',
    body: 'Mit diesen Filtern findest du schnell, was offen, abgeschlossen oder noch als Entwurf gespeichert ist.',
  },
  {
    selector: '[data-tour="nav-documents"]',
    title: 'Zurück zu Dokumenten',
    body: 'Dieser Bereich bringt dich jederzeit zurück in deine Arbeitsliste. Das ist der zentrale Startpunkt für die tägliche Nutzung.',
  },
  {
    selector: '[data-tour="nav-vorlagen"]',
    title: 'Deutsche Vorlagen und Generatoren',
    body: 'Hier liegen NDA, Arbeitsvertrag, AV-Vertrag, X-Rechnung und weitere Generatoren. PDF erzeugen, in NexaSign hochladen, unterschreiben lassen.',
  },
];

const isDemoHost = () =>
  typeof window !== 'undefined' && window.location.hostname === 'nexasign-demo.nexastack.co';

const shouldForceTour = (search: string) => new URLSearchParams(search).get('tour') === '1';

export const DemoProductTour = () => {
  const location = useLocation();

  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);

  const enabled = useMemo(() => {
    return (
      typeof window !== 'undefined' &&
      location.pathname.includes('/documents') &&
      (isDemoHost() || shouldForceTour(location.search))
    );
  }, [location.pathname, location.search]);

  const activeStep = activeIndex === null ? null : TOUR_STEPS[activeIndex];

  useEffect(() => {
    if (!enabled) {
      setActiveIndex(null);
      return;
    }

    const hasSeenTour = window.localStorage.getItem(STORAGE_KEY) === 'done';

    if (!hasSeenTour || shouldForceTour(location.search)) {
      setActiveIndex(0);
    }
  }, [enabled, location.search]);

  useEffect(() => {
    if (!activeStep) {
      setSpotlight(null);
      return;
    }

    const updatePosition = (shouldScrollIntoView = false) => {
      const target = document.querySelector<HTMLElement>(activeStep.selector);

      if (!target) {
        setSpotlight(null);
        return;
      }

      if (shouldScrollIntoView) {
        target.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
      }

      window.setTimeout(() => {
        const rect = target.getBoundingClientRect();
        const padding = 10;

        if (rect.width === 0 || rect.height === 0) {
          setSpotlight(null);
          return;
        }

        setSpotlight({
          top: Math.max(rect.top - padding, 12),
          left: Math.max(rect.left - padding, 12),
          width: Math.min(rect.width + padding * 2, window.innerWidth - 24),
          height: Math.min(rect.height + padding * 2, window.innerHeight - 24),
        });
      }, 160);
    };

    const handlePositionChange = () => updatePosition();

    updatePosition(true);

    window.addEventListener('resize', handlePositionChange);
    window.addEventListener('scroll', handlePositionChange, true);

    return () => {
      window.removeEventListener('resize', handlePositionChange);
      window.removeEventListener('scroll', handlePositionChange, true);
    };
  }, [activeStep]);

  const closeTour = () => {
    window.localStorage.setItem(STORAGE_KEY, 'done');
    setActiveIndex(null);
  };

  const nextStep = () => {
    if (activeIndex === null) {
      return;
    }

    if (activeIndex >= TOUR_STEPS.length - 1) {
      closeTour();
      return;
    }

    setActiveIndex(activeIndex + 1);
  };

  const previousStep = () => {
    if (activeIndex === null || activeIndex === 0) {
      return;
    }

    setActiveIndex(activeIndex - 1);
  };

  if (!activeStep || !spotlight) {
    return null;
  }

  const currentIndex = activeIndex ?? 0;
  const popoverOnRight = spotlight.left + spotlight.width / 2 < window.innerWidth / 2;
  const popoverLeft = popoverOnRight
    ? Math.min(spotlight.left + spotlight.width + 18, window.innerWidth - 358)
    : Math.max(spotlight.left - 338, 18);
  const popoverStyle = {
    top: Math.min(Math.max(spotlight.top, 24), window.innerHeight - 260),
    left: Math.max(popoverLeft, 18),
  };

  return (
    <div className="fixed inset-0 z-[100]">
      <div
        className="pointer-events-none fixed rounded-xl border-2 border-primary bg-transparent shadow-[0_0_0_9999px_rgba(20,1,0,0.62)] transition-all duration-200"
        style={spotlight}
      />

      <div
        className={cn(
          'fixed w-[min(340px,calc(100vw-32px))] rounded-lg border border-border bg-background p-4 shadow-2xl',
          'text-foreground',
        )}
        style={popoverStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="nexasign-demo-tour-title"
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Schritt {currentIndex + 1} von {TOUR_STEPS.length}
            </div>
            <h2 id="nexasign-demo-tour-title" className="mt-1 text-lg font-semibold">
              {activeStep.title}
            </h2>
          </div>

          <button
            type="button"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={closeTour}
            aria-label="Tour schließen"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm leading-6 text-muted-foreground">{activeStep.body}</p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <Button type="button" variant="ghost" onClick={closeTour}>
            Überspringen
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={previousStep}
              disabled={currentIndex === 0}
            >
              Zurück
            </Button>
            <Button type="button" onClick={nextStep}>
              {currentIndex === TOUR_STEPS.length - 1 ? 'Fertig' : 'Weiter'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
