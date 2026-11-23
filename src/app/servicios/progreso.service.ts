// ProgresoService — Sesión 44. La capa de IndexedDB (db.ts) y la de cifrado (crypto.ts) siguen IGUAL que en las
// versiones anteriores; el servicio las ofrece a los componentes: el progreso por modelo, las fichas descargadas,
// la clave de las notas (en memoria, nunca en disco) y las acciones que los cambian.
// Un servicio es una clase con estado que Angular crea UNA vez y entrega a quien la pida (inject).
import { Injectable, computed, signal } from "@angular/core";
import {
  abrirBaseDeDatos, alternarFavorito, guardarConfig, guardarNotaDeEstudio, leerNotaDeEstudio, marcarModeloVisto,
  obtenerConfig, obtenerDescargas, obtenerProgreso, obtenerTodoElProgreso, type RegistroProgreso,
} from "../../db";
import { crearVerificador, derivarClaveDesdeContrasena, generarSal, verificarClave, type TextoCifrado } from "../../crypto";

export interface MensajeNota {
  texto: string;
  tipo: "ok" | "error" | "info";
}

@Injectable({ providedIn: "root" })
export class ProgresoService {
  // La base se abre una sola vez; la promesa se guarda para que cualquier manejador pueda esperarla.
  readonly dbPromesa: Promise<IDBDatabase> = abrirBaseDeDatos();

  readonly progreso = signal<Map<string, RegistroProgreso>>(new Map());
  readonly descargados = signal<Set<string>>(new Set());
  readonly clave = signal<CryptoKey | null>(null);
  readonly seleccionado = signal<string | null>(null);
  readonly textoNota = signal("");
  readonly mensaje = signal<MensajeNota>({ texto: "", tipo: "info" });

  readonly recientes = computed(() =>
    [...this.progreso().values()].filter((r) => r.ultimaVisita).sort((a, b) => (b.ultimaVisita ?? 0) - (a.ultimaVisita ?? 0)).slice(0, 3),
  );
  readonly favoritos = computed(() => [...this.progreso().values()].filter((r) => r.favorito === 1));

  constructor() {
    void this.recargar();
  }

  async recargar(): Promise<void> {
    const db = await this.dbPromesa;
    const [todo, descargas] = await Promise.all([obtenerTodoElProgreso(db), obtenerDescargas(db)]);
    this.progreso.set(new Map(todo.map((p) => [p.modeloId, p])));
    this.descargados.set(new Set(descargas.filter((d) => d.estado === "listo").map((d) => d.modeloId)));
  }

  async abrirModelo(id: string): Promise<void> {
    this.seleccionado.set(id);
    await marcarModeloVisto(await this.dbPromesa, id);
    this.mensaje.set({ texto: this.clave() ? "" : "Desbloquea con tu contraseña para leer o escribir la nota.", tipo: "info" });
    await this.recargar();
    await this.cargarNota();
  }

  async alternarFavorito(id: string): Promise<void> {
    await alternarFavorito(await this.dbPromesa, id);
    await this.recargar();
  }

  private async cargarNota(): Promise<void> {
    this.textoNota.set("");
    const id = this.seleccionado();
    const clave = this.clave();
    if (!id || !clave) return;
    const registro = await obtenerProgreso(await this.dbPromesa, id);
    if (!registro?.notaCifrada) return;
    try {
      this.textoNota.set((await leerNotaDeEstudio(clave, registro)) ?? "");
      this.mensaje.set({ texto: "Nota descifrada con tu contraseña.", tipo: "ok" });
    } catch {
      this.mensaje.set({ texto: "No se pudo descifrar la nota con la clave actual.", tipo: "error" });
    }
  }

  async desbloquear(contrasena: string): Promise<void> {
    if (!contrasena) return;
    const db = await this.dbPromesa;
    let sal = await obtenerConfig<Uint8Array<ArrayBuffer>>(db, "sal");
    const verificador = await obtenerConfig<TextoCifrado>(db, "verificador");
    if (!sal) {
      sal = generarSal();
      await guardarConfig(db, "sal", sal);
    }
    const candidata = await derivarClaveDesdeContrasena(contrasena, sal);
    if (!verificador) {
      await guardarConfig(db, "verificador", await crearVerificador(candidata));
      this.clave.set(candidata);
      this.mensaje.set({ texto: "Contraseña creada. Tus notas de estudio se cifrarán con ella.", tipo: "ok" });
    } else if (await verificarClave(candidata, verificador)) {
      this.clave.set(candidata);
      this.mensaje.set({ texto: "Notas desbloqueadas.", tipo: "ok" });
    } else {
      this.mensaje.set({ texto: "Contraseña incorrecta.", tipo: "error" });
      return;
    }
    await this.cargarNota();
  }

  bloquear(): void {
    this.clave.set(null);
    this.textoNota.set("");
    this.mensaje.set({ texto: "Notas bloqueadas.", tipo: "info" });
  }

  async guardarNota(): Promise<void> {
    const clave = this.clave();
    const id = this.seleccionado();
    if (!clave || !id) return;
    await guardarNotaDeEstudio(await this.dbPromesa, clave, id, this.textoNota());
    this.mensaje.set({ texto: "Nota guardada cifrada (AES-GCM) en IndexedDB.", tipo: "ok" });
  }
}
