# TPLOGISTICALM con PHP y MariaDB

Esta es una copia del proyecto original adaptada para usar PHP como servidor y MariaDB para guardar paquetes, vehículos, viajes e historial. El proyecto original sigue intacto.

## Requisitos

- Docker Desktop abierto y en estado **Running**.
- Conexión a internet la primera vez para descargar `php:8.3-apache` (la imagen PHP no aparece entre las que ya están instaladas).
- Un archivo local `.env` con contraseñas para MariaDB. No se publica en Git; partí de `.env.example` y configurá contraseñas propias.

## Cómo iniciarlo

1. Abrí esta carpeta `TPLOGISTICALM-PHP` en VS Code.
2. Copiá `.env.example` como `.env` y configurá allí las contraseñas locales. Si ya tenías una base creada, conservá los valores con que la inicializaste.
3. Abrí la terminal integrada (**Terminal → New Terminal**).
4. Ejecutá `docker compose up -d --build`.
5. Esperá a que termine y abrí `http://localhost:8080`.
6. Para ver las tablas, abrí `http://localhost:8081` e ingresá como usuario `root` con la contraseña definida en `.env`.

No se usa Live Server para esta versión: Apache entrega PHP y PHP consulta MariaDB. La base se inicializa con los datos de demostración la primera vez. Los cambios se guardan en el volumen de Docker `mariadb_data`.

Para detener los servicios: `docker compose down`. Esto conserva la base. No uses `docker compose down -v` si querés conservar los datos.

## Qué conecta cada parte

- `index.html`, `css/` y `js/`: interfaz y comportamiento del proyecto.
- `api.php`: recibe y devuelve JSON; es el puente entre JavaScript y MariaDB.
- `database/init.sql`: crea tablas y carga los datos iniciales una sola vez.
- `Dockerfile`: prepara PHP con Apache y el controlador PDO de MySQL/MariaDB.
- `docker-compose.yml`: coordina la web, MariaDB y phpMyAdmin.

Cuando registrás un paquete, armás un viaje o marcás una entrega, JavaScript actualiza la pantalla y envía el estado a `api.php`; PHP lo persiste en la base. Al recargar, la aplicación vuelve a consultar los datos de MariaDB.

## Recepción de compras desde TPLM

Con esta aplicación encendida, ejecutá `TPLM` con Live Server. Al completar una compra, su formulario envía los datos del cliente, dirección, productos, cantidades y total a `api.php?resource=orders`. En esta versión, el formulario de TPLM debe abrirse desde `localhost` o `127.0.0.1` para que la API local permita la conexión. En Logística, abrí **Pedidos web** y, si la compra se envió desde otra pestaña, elegí **Actualizar pedidos**.

La compra aparece como pedido recibido, sin convertirse automáticamente en paquete: la tienda no aporta peso ni dimensiones. Esos valores deben cargarse cuando se prepare el envío.

## Nota para explicar en clase

“El navegador muestra la página hecha con HTML, CSS y JavaScript. En vez de guardar los cambios solamente en el navegador, JavaScript pide los datos a una API sencilla escrita en PHP. PHP usa PDO para comunicarse con MariaDB. Docker levanta los tres servicios para que funcionen juntos en mi computadora.”

Las contraseñas locales se guardan en `.env`, que Git excluye. No uses credenciales de práctica en un servidor público.
