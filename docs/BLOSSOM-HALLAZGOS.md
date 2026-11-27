# Hallazgos sobre Blossom UI 2.3.0

Cosas que hubo que resolver en la aplicación y que conviene mejorar en la librería.

| Componente | Qué falta | Rodeo usado acá |
| --- | --- | --- |
| `Navbar` | Animar el menú móvil | `AnimatedMenu.tsx` intercepta el click y anima con Web Animations |
| `Navbar` | Que el menú flote en lugar de empujar la página | CSS sobre `header > div:nth-child(2)` |
| `Navbar` | Cerrarse al tocar afuera o al desplazarse | `AnimatedMenu.tsx` |
| `Navbar` | Avisar si está abierto (`onOpenChange`) | Se lee `aria-expanded` |
| `Footer` | `className` | Selectores desde un contenedor |
| `Footer` | `brand` como `ReactNode` (para un logo) | Icono por CSS |
| `Footer` | Columnas ajustables en celular | `!important` sobre el estilo en línea |
| `Slider` | Escribir el valor a mano | `ValueSlider.tsx` superpone un botón y un campo |
| `Card` | El ancho máximo propio no deja llenar una grilla; `max-w-none` no alcanza | `!max-w-none` |
| `FileUpload` | Los errores de archivo rechazado están fijos en inglés | Sin rodeo |
| `FileUpload` | Valor controlado, para cargar un archivo desde afuera (pegar) | Se vuelve a montar con `key` |
