"use client";

import { useState } from "react";
import { cn } from "../utils/cn";

export interface VideoFrameProps {
  embedUrl: string;
  posterImageUrl?: string;
  autoplay?: boolean;
  className?: string;
}

/**
 * Único punto donde se embebe un video (VSL). Carga bajo demanda: mientras
 * no se hace click no existe ningún <iframe> en el DOM, así que un embed
 * pesado no compite con el LCP del hero. El único componente "use client"
 * de la primera pantalla — todo lo demás en el sistema es Server Component.
 */
export function VideoFrame({ embedUrl, posterImageUrl, autoplay = false, className }: VideoFrameProps) {
  const [loaded, setLoaded] = useState(autoplay);

  return (
    <div className={cn("relative aspect-video w-full overflow-hidden rounded-base bg-surface-muted", className)}>
      {loaded ? (
        // Siempre con autoplay=1 una vez montado: si `loaded` se activó por
        // la prop `autoplay`, es la carga inicial de la página; si se activó
        // por el click del usuario en la fachada, ese click YA es el gesto
        // de reproducción — pedirle un segundo click dentro del iframe sería
        // el bug real que esto corrige.
        <iframe
          src={`${embedUrl}${embedUrl.includes("?") ? "&" : "?"}autoplay=1`}
          title="Video"
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      ) : (
        <button
          type="button"
          onClick={() => setLoaded(true)}
          aria-label="Reproducir video"
          className="group absolute inset-0 flex h-full w-full items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          style={posterImageUrl ? { backgroundImage: `url(${posterImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform duration-base group-hover:scale-105">
            <svg viewBox="0 0 24 24" fill="currentColor" className="ml-1 h-6 w-6">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </button>
      )}
    </div>
  );
}
