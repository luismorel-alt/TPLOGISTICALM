# TP LOGISTICALM

Proyecto académico de logística que fui construyendo por etapas. La primera versión muestra las pantallas con HTML, CSS y JavaScript. La carpeta `TPLOGISTICALM-PHP` agrega PHP, MariaDB y Docker para guardar la información y recibir pedidos de la tienda TPLM.

`TPLM` es otro trabajo y conserva su propio repositorio y publicación en [GitHub](https://github.com/luismorel-alt/TPLM). Este proyecto es independiente; la conexión de pedidos está preparada para probarse entre los dos proyectos abiertos en la misma computadora.

## Herramientas que uso

- Visual Studio Code para abrir el proyecto y trabajar con los archivos.
- Live Server para ejecutar la versión inicial y la tienda TPLM.
- Docker Desktop para iniciar Apache con PHP, MariaDB y phpMyAdmin.
- Git y GitHub para guardar y compartir el código fuente.

## Paso 1: abrir la versión inicial

1. Abrí la carpeta `TPLOGISTICALM` en Visual Studio Code.
2. En el explorador, abrí `index.html`.
3. Hacé clic en **Go Live** abajo a la derecha.
4. Se abre la demostración inicial. Esta versión obtiene los datos de `data/logistica.json` y conserva sus cambios en el navegador.

## Paso 2: iniciar la versión PHP y MariaDB

La versión con base de datos está en `TPLOGISTICALM-PHP`. No se ejecuta con Live Server.

1. Abrí Docker Desktop y esperá a que indique que está iniciado.
2. En VS Code, abrí **Terminal → New Terminal**. Si el prompt ya termina en `TPLOGISTICALM>`, entrá a la subcarpeta con:

   ```powershell
   cd .\TPLOGISTICALM-PHP
   ```

   También podés abrir `TPLOGISTICALM-PHP` como carpeta en VS Code; en ese caso no necesitás cambiar de carpeta en la terminal.

4. Iniciá los servicios con:

   ```powershell
   docker compose up -d --build
   ```

5. Abrí la aplicación en [http://localhost:8080](http://localhost:8080).
6. Para consultar las tablas, abrí [http://localhost:8081](http://localhost:8081). En phpMyAdmin usá el usuario `root` y la contraseña guardada en `.env`.

Si aparece `no configuration file provided`, revisá que la terminal esté dentro de `TPLOGISTICALM-PHP`; ahí está `docker-compose.yml`. Escribí `--build` sin punto al final.

Para detener los servicios sin borrar la base:

```powershell
docker compose down
```

No uses `docker compose down -v` si querés conservar los datos guardados.

## Paso 3: mostrar cómo llega una compra desde TPLM

Esta prueba conecta la tienda TPLM con la versión PHP de Logística usando la API local. Docker debe estar iniciado y TPLM debe abrirse con Live Server en la misma PC.

1. En una terminal de VS Code, iniciá primero Docker con los pasos anteriores.
2. Abrí la carpeta del proyecto `TPLM` en otra ventana de VS Code.
3. Abrí `index.html` y presioná **Go Live**. La dirección debe empezar con `http://localhost:` o `http://127.0.0.1:`. No abras el HTML como archivo.
4. En la tienda, elegí un producto y agregalo al carrito.
5. Abrí el carrito y presioná **Finalizar compra**.
6. Completá el formulario de envío, aceptá los términos y presioná **Enviar**.
7. La confirmación de la tienda debe mostrar un código parecido a `WEB-20261114-00004`.
8. Volvé a la pestaña de Logística (`http://localhost:8080`). En el menú izquierdo, elegí **Pedidos web** y presioná **Actualizar pedidos**.
9. Mostrá el código, el nombre del cliente, el domicilio, los productos, las cantidades y el total.

La bandeja **Pedidos web** es distinta de la sección **Paquetes**. La compra queda recibida, pero todavía no es un paquete de despacho: el formulario de la tienda no conoce el peso ni las medidas físicas. Para despacharla, primero se deben confirmar esos datos reales y cargarlos en Logística.

### Si se quiere mostrar el pedido de prueba ya creado

En **Pedidos web**, presioná **Actualizar pedidos**. El registro `WEB-20261114-00003` está marcado como **DE PRUEBA - NO REAL** y tiene un artículo de prueba de U$S 2. No es una compra verdadera. En la lista pueden aparecer además las compras reales que se hayan enviado desde TPLM.

## Cómo explicarlo en clase

> “La tienda TPLM arma una compra con el carrito y los datos del formulario. JavaScript envía esa información como JSON a una API escrita en PHP. PHP guarda el pedido y sus productos en MariaDB. En Logística puedo consultarlo en Pedidos web. Después, cuando se conoce el peso y las medidas del paquete, se puede preparar el despacho.”

En Docker, `web` es Apache con PHP; `db` es MariaDB; y `phpmyadmin` permite mirar la base desde el navegador. `api.php` conecta PHP con MariaDB. La tabla `web_orders` guarda los datos del comprador y la tabla `web_order_items` guarda los productos.

## Qué está hecho y qué sigue

- La versión inicial permite registrar y consultar paquetes, preparar viajes y seguir entregas con datos de demostración.
- La versión PHP carga paquetes y vehículos desde MariaDB y conserva los cambios en esa base.
- La integración local recibe compras de TPLM como pedidos separados de los paquetes.
- El siguiente paso de mejora puede ser definir cómo convertir un pedido recibido en uno o más paquetes una vez que se registren peso y dimensiones.

## Publicación en GitHub

GitHub puede mostrar este repositorio, los archivos y este README. GitHub Pages publica sitios estáticos; no ejecuta PHP ni MariaDB. Para que otra persona pruebe la versión con base de datos en línea, más adelante habría que elegir un servicio que admita PHP y MariaDB, o una aplicación Docker.

La integración con `http://localhost:8080` es para una prueba local: si el profesor abre TPLM desde su computadora, `localhost` apunta a la computadora del profesor, no a la tuya. Por eso la publicación de TPLM puede seguir funcionando por separado, mientras que esta demostración de conexión entre proyectos se hace localmente en tu PC.

Las contraseñas locales se guardan en `.env`, un archivo excluido de Git. No se deben reutilizar en un servidor público.

Para los detalles técnicos de la variante con PHP, consultá [`TPLOGISTICALM-PHP/README.md`](TPLOGISTICALM-PHP/README.md).
