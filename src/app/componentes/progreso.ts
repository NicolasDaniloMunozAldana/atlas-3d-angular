// Progreso — Sesión 44. «Continuar viendo», favoritos y la nota de estudio cifrada (Sesiones 33-34).
import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { CATALOGO } from "../../modelos";
import { ProgresoService } from "../servicios/progreso.service";
import { PanelService } from "../servicios/panel.service";

@Component({
  selector: "section[progreso]",
  imports: [FormsModule],
  templateUrl: "./progreso.html",
  host: { class: "progreso", id: "progreso" },
})
export class Progreso {
  protected readonly svc = inject(ProgresoService);
  private readonly panel = inject(PanelService);
  protected readonly contrasena = signal("");

  protected nombreDe(id: string): string {
    return CATALOGO.find((m) => m.id === id)?.nombre ?? id;
  }

  protected abrir(id: string): void {
    void this.svc.abrirModelo(id);
    this.panel.elegirModelo(id);
  }

  protected async desbloquear(e: Event): Promise<void> {
    e.preventDefault();
    const valor = this.contrasena();
    this.contrasena.set("");
    await this.svc.desbloquear(valor);
  }
}
