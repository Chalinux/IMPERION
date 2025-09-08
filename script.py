import os
import json

# Carpeta base: directamente la carpeta "server"
CARPETA_BASE = r"C:\Users\franc\Desktop\IMPERION\server"

# Solo vamos a incluir .js
EXTENSIONES_PERMITIDAS = {".js"}

resultado = {}

def escanear_directorio(directorio_base):
    for raiz, dirs, archivos in os.walk(directorio_base):
        # Evitar entrar en node_modules
        if "node_modules" in dirs:
            dirs.remove("node_modules")

        for archivo in archivos:
            ext = os.path.splitext(archivo)[1].lower()

            if ext in EXTENSIONES_PERMITIDAS:
                ruta_completa = os.path.join(raiz, archivo)
                ruta_relativa = os.path.relpath(ruta_completa, directorio_base)

                try:
                    with open(ruta_completa, "r", encoding="utf-8", errors="ignore") as f:
                        contenido = f.read()
                    resultado[ruta_relativa] = contenido
                except Exception as e:
                    print(f"⚠️ Error leyendo {ruta_completa}: {e}")

# Ejecutar escaneo
escanear_directorio(CARPETA_BASE)

# Guardar en JSON fuera de server
ruta_salida = os.path.join(os.path.dirname(CARPETA_BASE), "js_server.json")
with open(ruta_salida, "w", encoding="utf-8") as f:
    json.dump(resultado, f, indent=2, ensure_ascii=False)

print(f"✅ Exportación completada. Archivo guardado en: {ruta_salida}")
