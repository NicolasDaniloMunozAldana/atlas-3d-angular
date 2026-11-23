// Catalogo — Sesión 44. Las 8 tarjetas del catálogo con favorito, «visto» y «Ver en 3D» (Sesión 33).
// Antes, cada cambio terminaba en render(): borrar todo y reescribirlo. Ahora cada tarjeta es un componente
// y Angular cambia solo lo que cambió.
import { Component, afterNextRender, computed, inject, input } from "@angular/core";
import { CATALOGO } from "../../modelos";
import { ProgresoService } from "../servicios/progreso.service";
import { PanelService } from "../servicios/panel.service";

interface Patron { id: string; nombre: string; resumen: string }

function haceCuanto(marca: number): string {
  const segundos = Math.max(0, Math.round((Date.now() - marca) / 1000));
  if (segundos < 60) return "hace unos segundos";
  const minutos = Math.round(segundos / 60);
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  return `hace ${Math.round(horas / 24)} d`;
}

@Component({
  selector: "article[tarjeta]",
  templateUrl: "./tarjeta.html",
  host: {
    class: "patron-card",
    "[class.sin-conexion]": "descargado()",
    "[class.destacada]": "destacada()",
    "[class.seleccionada]": "seleccionada()",
    "[id]": '"tarjeta-" + patron().id',
    "[attr.data-id]": "patron().id",
  },
})
export class Tarjeta {
  readonly patron = input.required<Patron>();
  readonly numero = input.required<number>();
  readonly destacada = input(false);

  // Las acciones no se pasan de padre a hijo: la tarjeta pide los servicios que necesita.
  protected readonly progresoSvc = inject(ProgresoService);
  private readonly panel = inject(PanelService);

  protected readonly registro = computed(() => this.progresoSvc.progreso().get(this.patron().id));
  protected readonly favorito = computed(() => this.registro()?.favorito === 1);
  protected readonly descargado = computed(() => this.progresoSvc.descargados().has(this.patron().id));
  protected readonly seleccionada = computed(() => this.progresoSvc.seleccionado() === this.patron().id);
  protected readonly visita = computed(() => {
    const v = this.registro()?.ultimaVisita;
    return v ? `Visto ${haceCuanto(v)}` : "Sin visitar";
  });

  constructor() {
    // Una notificación puede abrir la app con ?modelo=ID para destacar esa tarjeta (Sesión 37).
    afterNextRender(() => {
      if (this.destacada()) document.getElementById(`tarjeta-${this.patron().id}`)?.scrollIntoView({ block: "center" });
    });
  }

  protected abrir(): void {
    void this.progresoSvc.abrirModelo(this.patron().id);
    this.panel.elegirModelo(this.patron().id);
  }

  protected ver3D(): void {
    this.panel.elegirModelo(this.patron().id);
    document.querySelector("#visor")?.scrollIntoView({ block: "center", behavior: "smooth" });
  }
}

@Component({
  selector: "section[catalogo]",
  imports: [Tarjeta],
  templateUrl: "./catalogo.html",
  host: { class: "catalogo" },
})
export class Catalogo {
  protected readonly patrones: Patron[] = CATALOGO.map((m) => ({ id: m.id, nombre: m.nombre, resumen: m.resumen }));
  protected readonly destacado = new URLSearchParams(location.search).get("modelo");
}
