# PhysioLearn iPad – Offline-fähige PWA

Keine monatlichen Builder-Credits nötig. Dashboard, 37 Muskeldatensätze, Quellen, Quiz, Karteikarten, Favoriten, Fortschritt, Anatomie-Illustrationen und Dark Mode.

## Öffnen
Dies ist eine Web-App. Sie muss einmal über einen HTTPS-Host veröffentlicht werden, um im iPad-Safari zu laufen. Lade den Inhalt dieses Ordners zu einem statischen Webhost (z. B. GitHub Pages oder Netlify) hoch. Danach in Safari „Teilen → Zum Home-Bildschirm“.

Die generierten Illustrationen sind keine fachlich geprüften Anatomieatlanten. Angaben und Abbildungen vor klinischer Nutzung validieren. Ein interaktives 3D-Mesh ist **noch nicht** integriert. Die Krankheitsbilder und Übungsbereiche sind bislang teilweise Platzhalter.

## Weiterentwicklung
Die Daten liegen unter `data/muscles.json`; Bilder unter `assets/`. Die Datei `data/region-images.json` ordnet Bilder Regionen zu.
