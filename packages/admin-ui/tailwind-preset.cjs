/**
 * Preset de Tailwind del admin: valores fijos, no custom properties. A
 * diferencia de packages/ui (un theme por Offer, resuelto en runtime), el
 * admin tiene un único lenguaje visual estable — no hay nada que
 * intercambiar, así que no hace falta la capa de CSS vars.
 */
module.exports = {
  theme: {
    extend: {
      colors: {
        canvas: "#F7F7FB",
        surface: "#FFFFFF",
        "surface-sunken": "#EEF0F4",
        border: {
          DEFAULT: "#E3E3EA",
          strong: "#CFD0DC",
        },
        ink: {
          DEFAULT: "#1B1D29",
          muted: "#6C7086",
          faint: "#9497AB",
        },
        accent: {
          DEFAULT: "#4338CA",
          strong: "#372DAE",
          soft: "#EEF0FD",
        },
        success: {
          DEFAULT: "#157F3C",
          soft: "#E6F6EC",
        },
        warning: {
          DEFAULT: "#B4680A",
          soft: "#FDF1E1",
        },
        danger: {
          DEFAULT: "#B42318",
          soft: "#FDECEA",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
        mono: ["ui-monospace", '"SF Mono"', '"Cascadia Code"', '"Roboto Mono"', "Consolas", "monospace"],
      },
      borderRadius: {
        DEFAULT: "6px",
        md: "6px",
        lg: "8px",
      },
      boxShadow: {
        pop: "0 8px 24px -8px rgb(27 29 41 / 0.16)",
      },
    },
  },
};
