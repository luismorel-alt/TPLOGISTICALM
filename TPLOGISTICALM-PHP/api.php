<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (preg_match('~^https?://(localhost|127\.0\.0\.1):\d+$~', $origin)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Vary: Origin');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
}
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

function respond(array $data, int $status = 200): never {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function dbDate(string $value): string {
    $timestamp = strtotime($value);
    if ($timestamp === false) throw new InvalidArgumentException('Fecha inválida.');
    return gmdate('Y-m-d H:i:s', $timestamp);
}

try {
    $host = getenv('DB_HOST') ?: 'db';
    $name = getenv('DB_NAME') ?: 'tplogisticalm';
    $user = getenv('DB_USER') ?: 'app';
    $pass = getenv('DB_PASSWORD') ?: '';
    $pdo = new PDO("mysql:host=$host;dbname=$name;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    // También crea estas tablas en bases ya existentes, sin borrar registros.
    $pdo->exec("CREATE TABLE IF NOT EXISTS web_orders (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        order_code VARCHAR(40) UNIQUE,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        address_line1 VARCHAR(180) NOT NULL,
        address_line2 VARCHAR(180) NOT NULL DEFAULT '',
        city VARCHAR(120) NOT NULL,
        country VARCHAR(80) NOT NULL,
        postal_code VARCHAR(30) NOT NULL,
        total DECIMAL(12,2) NOT NULL,
        status VARCHAR(40) NOT NULL DEFAULT 'Recibido',
        created_at DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS web_order_items (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        order_id BIGINT UNSIGNED NOT NULL,
        product_id BIGINT NOT NULL,
        title VARCHAR(180) NOT NULL,
        category VARCHAR(120) NOT NULL DEFAULT '',
        quantity INT UNSIGNED NOT NULL,
        unit_price DECIMAL(12,2) NOT NULL,
        line_total DECIMAL(12,2) NOT NULL,
        CONSTRAINT fk_web_order_item_order FOREIGN KEY (order_id) REFERENCES web_orders(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    // Agrega los datos de ruta a bases ya creadas, sin borrar registros.
    foreach ([
        'packages' => ['postal_code' => "VARCHAR(8) NOT NULL DEFAULT ''", 'zone' => "VARCHAR(32) NOT NULL DEFAULT 'Sin clasificar'"],
        'trips' => ['zone' => "VARCHAR(32) NOT NULL DEFAULT 'Sin clasificar'"],
        'trip_packages' => ['stop_order' => 'INT NOT NULL DEFAULT 0'],
    ] as $table => $columns) {
        foreach ($columns as $column => $definition) {
            $check = $pdo->prepare('SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?');
            $check->execute([$table, $column]);
            if (!(int)$check->fetchColumn()) $pdo->exec("ALTER TABLE `$table` ADD COLUMN `$column` $definition");
        }
    }
    $pdo->exec("INSERT INTO vehicles(id,name,category,model,pbv_kg,tare_kg,volume_m3) VALUES
        ('utilitario-fiorino','Fiat Fiorino','Utilitario pequeño','Fiat Fiorino',0,0,3),
        ('utilitario-partner','Peugeot Partner','Utilitario mediano','Peugeot Partner',0,0,4),
        ('utilitario-kangoo','Renault Kangoo','Utilitario mediano','Renault Kangoo',0,0,4),
        ('furgon-trafic','Renault Trafic','Furgón mediano','Renault Trafic',0,0,8),
        ('furgon-transit-custom','Ford Transit Custom','Furgón mediano','Ford Transit Custom',0,0,8),
        ('furgon-sprinter','Mercedes-Benz Sprinter','Furgón grande','Mercedes-Benz Sprinter',0,0,15),
        ('furgon-daily','Iveco Daily','Furgón grande','Iveco Daily',0,0,19)
        ON DUPLICATE KEY UPDATE category=VALUES(category), model=VALUES(model), volume_m3=VALUES(volume_m3)");

    if (($_GET['resource'] ?? '') === 'orders') {
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            $orders = $pdo->query('SELECT id,order_code,first_name,last_name,address_line1,address_line2,city,country,postal_code,total,status,created_at FROM web_orders ORDER BY id DESC')->fetchAll();
            $itemsQuery = $pdo->prepare('SELECT product_id,title,category,quantity,unit_price,line_total FROM web_order_items WHERE order_id=? ORDER BY id');
            foreach ($orders as &$order) {
                $itemsQuery->execute([$order['id']]); $order['items'] = $itemsQuery->fetchAll();
                $order['total'] = (float)$order['total'];
                $order['createdAt'] = date(DATE_ATOM, strtotime($order['created_at'].' UTC'));
                unset($order['created_at']);
            } unset($order);
            respond(['orders'=>$orders]);
        }
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') respond(['error'=>'Método no permitido.'],405);
        $order = json_decode(file_get_contents('php://input'), true, 512, JSON_THROW_ON_ERROR);
        $required = ['firstName','lastName','addressLine1','city','country','postalCode','items'];
        foreach ($required as $field) if (empty($order[$field])) respond(['error'=>"Falta completar $field."],400);
        if (!is_array($order['items']) || count($order['items']) === 0) respond(['error'=>'El pedido no tiene productos.'],400);
        $total = 0.0;
        foreach ($order['items'] as $item) {
            $quantity=(int)($item['quantity']??0); $price=(float)($item['price']??-1);
            if ($quantity<1 || $price<0 || trim((string)($item['title']??''))==='') respond(['error'=>'Hay un producto inválido en el pedido.'],400);
            $total += $quantity*$price;
        }
        $pdo->beginTransaction();
        $insert=$pdo->prepare('INSERT INTO web_orders(first_name,last_name,address_line1,address_line2,city,country,postal_code,total,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)');
        $insert->execute([trim($order['firstName']),trim($order['lastName']),trim($order['addressLine1']),trim($order['addressLine2']??''),trim($order['city']),trim($order['country']),trim($order['postalCode']),$total,'Recibido',gmdate('Y-m-d H:i:s')]);
        $id=(int)$pdo->lastInsertId(); $code='WEB-'.gmdate('Ymd').'-'.str_pad((string)$id,5,'0',STR_PAD_LEFT);
        $pdo->prepare('UPDATE web_orders SET order_code=? WHERE id=?')->execute([$code,$id]);
        $itemInsert=$pdo->prepare('INSERT INTO web_order_items(order_id,product_id,title,category,quantity,unit_price,line_total) VALUES(?,?,?,?,?,?,?)');
        foreach ($order['items'] as $item) {
            $quantity=(int)$item['quantity']; $price=(float)$item['price'];
            $itemInsert->execute([$id,(int)($item['id']??0),trim($item['title']),trim((string)($item['category']??'')),$quantity,$price,$quantity*$price]);
        }
        $pdo->commit();
        respond(['ok'=>true,'orderCode'=>$code],201);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $vehicles = $pdo->query('SELECT id,name,category,model,pbv_kg,tare_kg,volume_m3 FROM vehicles')->fetchAll();
        foreach ($vehicles as &$v) {
            $v['pbvKg'] = (float)$v['pbv_kg']; $v['tareKg'] = (float)$v['tare_kg']; $v['volumeM3'] = (float)$v['volume_m3'];
            unset($v['pbv_kg'], $v['tare_kg'], $v['volume_m3']);
        } unset($v);
        $packages = $pdo->query('SELECT code,sender,recipient,origin,destination,description,weight_kg,length_m,width_m,height_m,volume_m3,status,received_at,trip_id,postal_code,zone FROM packages')->fetchAll();
        $history = $pdo->query('SELECT package_code,status,note,happened_at FROM package_history ORDER BY id DESC')->fetchAll();
        $byCode = [];
        foreach ($history as $item) $byCode[$item['package_code']][] = ['status'=>$item['status'],'note'=>$item['note'],'date'=>date(DATE_ATOM, strtotime($item['happened_at'].' UTC'))];
        foreach ($packages as &$p) {
            $p['weightKg']=(float)$p['weight_kg']; $p['lengthM']=(float)$p['length_m']; $p['widthM']=(float)$p['width_m']; $p['heightM']=(float)$p['height_m']; $p['volumeM3']=(float)$p['volume_m3'];
            $p['receivedAt']=date(DATE_ATOM, strtotime($p['received_at'].' UTC')); $p['tripId']=$p['trip_id']; $p['postalCode']=$p['postal_code']; $p['zone']=$p['zone']; $p['history']=$byCode[$p['code']] ?? [];
            unset($p['weight_kg'],$p['length_m'],$p['width_m'],$p['height_m'],$p['volume_m3'],$p['received_at'],$p['trip_id'],$p['postal_code']);
        } unset($p);
        $trips = $pdo->query('SELECT id,vehicle_id,status,created_at,zone FROM trips')->fetchAll();
        foreach ($trips as &$t) {
            $stmt=$pdo->prepare('SELECT package_code,stop_order FROM trip_packages WHERE trip_id=? ORDER BY stop_order,package_code'); $stmt->execute([$t['id']]);
            $routeRows=$stmt->fetchAll(); $t['vehicleId']=$t['vehicle_id']; $t['createdAt']=date(DATE_ATOM,strtotime($t['created_at'].' UTC')); $t['zone']=$t['zone']; $t['packageCodes']=array_column($routeRows,'package_code'); $t['stopOrders']=array_column($routeRows,'stop_order');
            unset($t['vehicle_id'],$t['created_at']);
        } unset($t);
        respond(['vehicles'=>$vehicles,'packages'=>$packages,'trips'=>$trips]);
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') respond(['error'=>'Método no permitido.'],405);
    $data = json_decode(file_get_contents('php://input'), true, 512, JSON_THROW_ON_ERROR);
    foreach (['vehicles','packages','trips'] as $key) if (!isset($data[$key]) || !is_array($data[$key])) respond(['error'=>"Falta la lista $key."],400);

    $pdo->beginTransaction();
    $pdo->exec('DELETE FROM trip_packages'); $pdo->exec('DELETE FROM trips'); $pdo->exec('DELETE FROM package_history'); $pdo->exec('DELETE FROM packages'); $pdo->exec('DELETE FROM vehicles');
    $vehicleStmt=$pdo->prepare('INSERT INTO vehicles(id,name,category,model,pbv_kg,tare_kg,volume_m3) VALUES(?,?,?,?,?,?,?)');
    foreach ($data['vehicles'] as $v) $vehicleStmt->execute([$v['id'],$v['name'],$v['category']??'',$v['model']??'',$v['pbvKg'],$v['tareKg'],$v['volumeM3']]);
    $packageStmt=$pdo->prepare('INSERT INTO packages(code,sender,recipient,origin,destination,description,weight_kg,length_m,width_m,height_m,volume_m3,status,received_at,trip_id,postal_code,zone) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    $historyStmt=$pdo->prepare('INSERT INTO package_history(package_code,status,note,happened_at) VALUES(?,?,?,?)');
    foreach ($data['packages'] as $p) {
        $packageStmt->execute([$p['code'],$p['sender'],$p['recipient'],$p['origin'],$p['destination'],$p['description'],$p['weightKg'],$p['lengthM'],$p['widthM'],$p['heightM'],$p['volumeM3']??($p['lengthM']*$p['widthM']*$p['heightM']),$p['status'],dbDate($p['receivedAt']),$p['tripId']??null,$p['postalCode']??'', $p['zone']??'Sin clasificar']);
        foreach (($p['history']??[]) as $h) $historyStmt->execute([$p['code'],$h['status'],$h['note']??'',dbDate($h['date'])]);
    }
    $tripStmt=$pdo->prepare('INSERT INTO trips(id,vehicle_id,status,created_at,zone) VALUES(?,?,?,?,?)');
    $joinStmt=$pdo->prepare('INSERT INTO trip_packages(trip_id,package_code,stop_order) VALUES(?,?,?)');
    foreach ($data['trips'] as $t) { $tripStmt->execute([$t['id'],$t['vehicleId'],$t['status'],dbDate($t['createdAt']),$t['zone']??'Sin clasificar']); foreach (($t['packageCodes']??[]) as $i=>$code) $joinStmt->execute([$t['id'],$code,(int)($t['stopOrders'][$i]??($i+1))]); }
    $pdo->commit();
    respond(['ok'=>true]);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    error_log((string)$e);
    respond(['error'=>'No se pudo completar la operación con la base MariaDB. Revisá Docker y los datos enviados.'],500);
}
