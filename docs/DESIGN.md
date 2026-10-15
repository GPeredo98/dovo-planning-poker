# DESIGN SYSTEM

Este documento define las reglas de diseño para el portafolio personal de Gabriel Peredo. La estética se define como Industrial Tech-Noir: una mezcla de minimalismo extremo, interfaces de alta fidelidad y acentos de luz orgánica (Aurora).

## 1. PALETA DE COLORES (DEEP SPACE)

| Elemento | Token | Valor Hex/Tailwind | Aplicacion |
| :--- | :--- | :--- | :--- |
| Fondo Base | bg-base | #030712 (Zinc 950) | Fondo principal de la pagina |
| Superficie | bg-surface | zinc-900/40 | Tarjetas y contenedores con transparencia |
| Borde | border-dim | zinc-800/50 | Divisores y bordes de tarjetas por defecto |
| Acento 1 | accent-cyan | cyan-500 | Interactividad, estados activos y badges |
| Acento 2 | accent-purple | purple-600 | Degradados secundarios y efectos de profundidad |
| Texto Primario | text-main | white | Titulos y acciones principales |
| Texto Secundario | text-muted | zinc-400 | Descripciones y metadatos |

## 2. TIPOGRAFIA Y ESCALA VISUAL

* Principal: Sans-serif moderna (Inter, Geist o SF Pro)
* Mono: Para metadatos y tecnologia (Fira Code o JetBrains Mono)

| Estilo | Tailwind Class | Uso |
| :--- | :--- | :--- |
| H1 Hero | text-7xl font-extrabold tracking-tight | Titulo principal del Home |
| H2 Section | text-5xl font-bold tracking-tight | Titulos de secciones |
| H3 Card | text-2xl font-bold | Titulos dentro de proyectos/tarjetas |
| Body | text-base text-zinc-400 leading-relaxed | Parrafos generales |
| Label | text-[10px] uppercase font-bold tracking-wider | Badges, tecnologias y fechas |

## 3. COMPONENTES DE UI SIGNATURE

### A. THE GLASSMORPHISM CARD
* Efecto: Fondo zinc-900/40 con backdrop-blur-md
* Borde: 1px solid zinc-800
* Hover: El borde cambia a cyan-500/50 y el fondo a zinc-900/60
* Radio: rounded-3xl (24px)

### B. AURORA GLOW (FONDO ORGANICO)
* Uso: Circulos absolutos con blur-[120px]
* Opacidad: No exceder el 20%
* Posicionamiento: Detras del contenido para dar profundidad sin sacrificar legibilidad

### C. THE GLOW BUTTON
* Principal: Fondo solido white, texto black, hover:scale-105
* Secundario: Fondo zinc-900, borde zinc-800, texto white
* Action (WA): Fondo green-600, sombra shadow-[0_0_20px_rgba(34,197,94,0.2)]

## 4. REGLAS DE INTERACCION Y ANIMACION

1. Micro-interacciones: Todo elemento interactivo debe tener una transicion de 300ms ease-in-out
2. Parallax Sutil: Las imagenes de los proyectos deben escalar un 10% (scale-110) al hacer hover sobre la tarjeta padre
3. Active State: Los enlaces del Navbar deben mostrar un cambio de color a blanco y una sutil sombra de texto
4. Scroll Behavior: Implementar scroll-smooth para la navegacion entre secciones mediante el Navbar

## 5. STACK TECNOLOGICO DE IMPLEMENTACION

* Framework: Next.js 15+ (App Router)
* Styling: Tailwind CSS
* Icons: Lucide-React (Stroke Width: 1.5 - 2)
* Components: Radix UI / Shadcn UI (Customizado con los tokens de arriba)

## 6. ESTRUCTURA DE PROMPT PARA NUEVA SECCION

Disena una nueva seccion para el portafolio de Gabriel Peredo siguiendo el DESIGN.md. Usa un fondo #030712, tarjetas con bg-zinc-900/40 y backdrop-blur, tipografia tracking-tight y acentos en cyan-500. Asegurate de que los iconos sean de lucide-react y que el estilo sea minimalista y tecnologico.