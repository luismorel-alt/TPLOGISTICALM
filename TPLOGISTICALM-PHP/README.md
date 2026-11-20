# TP LOGISTICALM

Este es mi trabajo final de Ingeniería de Software. Elegí representar una operación logística donde se reciben paquetes, se preparan viajes y se consulta el seguimiento de cada envío.

En el relevamiento tomé como referencia la planilla de transportes que usé en logística. Para los camiones, el sistema compara el peso acumulado con la carga útil (PBV menos tara) y también controla el volumen. Incorporé los utilitarios y furgones de menor tamaño de la pestaña `TiposDeTrasporte`. Esa hoja informa sus volúmenes, pero no PBV ni tara; por eso cargo esos dos datos reales antes de permitir despachos con esas unidades.

Para los repartos de Capital Federal y Gran Buenos Aires, cada paquete tiene una zona elegida por el operador y un CPA. La hoja de ruta agrupa el viaje por zona y muestra las paradas ordenadas por CPA como referencia. No calcula un recorrido por calles ni tiene información de tránsito.

## Cómo lo ejecuto

Abro PowerShell en VS Code y entro en la carpeta que contiene `docker-compose.yml`:

```powershell
Set-Location -LiteralPath 'C:\Users\Luis\Desktop\ISTEA\Tecnicatura 2 er cuatrimestre2026\1 - Ingeniería de Software\TPLOGISTICALM\TPLOGISTICALM-PHP'
Test-Path .\docker-compose.yml
Test-Path .\.env
docker compose config --quiet
docker compose up -d --build
docker compose ps
```

Después abro <http://localhost:8080>. phpMyAdmin queda en <http://localhost:8081>. Para detener los servicios sin borrar los datos, ejecuto `docker compose down`.

## Qué puedo mostrar

Puedo registrar un paquete con sus medidas, asignarle una zona y su CPA, preparar un despacho que respete peso y volumen, consultar la hoja de ruta y buscar el estado por código. La aplicación PHP guarda la información en MariaDB.
