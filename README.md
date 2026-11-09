# Compaginador-Web
Herramienta para compaginar pdfs para enviar a impresión.

Funciona 100 % en el navegador (usa [pdf-lib](https://pdf-lib.js.org/), incluido en `vendor/`), en cualquier sistema operativo. Sin servidor ni extensiones.

## Uso
1. Abre `index.html` (o sírvelo con `python3 -m http.server`).
2. Sube los PDFs de páginas individuales exportados desde InDesign (se ordenan por nombre; puedes reordenar arrastrando).
3. Elige el modo y descarga `compaginado.pdf`.

## Modos
- **Cuadernillo**: orden de imposición para grapar/doblar (8 | 1, 2 | 7, …), rellenando con páginas en blanco hasta múltiplo de 4.
- **Dobles consecutivas**: 2 páginas por cara sin reordenar (con opción de portada sola).
- **Solo unir**: concatena en orden.

Imprime a doble cara volteando por el borde corto.
