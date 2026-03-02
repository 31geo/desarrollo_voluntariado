-- Corregir todos los SIGNAL SQLSTATE en SPs llamados desde Hibernate
-- SIGNAL hace que Hibernate marque la transaccion como rollback-only
-- Reemplazamos con patron LEAVE que retorna 0 sin lanzar excepcion

DELIMITER $$

-- -------------------------------------------------------
-- sp_actualizar_donacion_inventario
-- -------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_actualizar_donacion_inventario$$
CREATE PROCEDURE sp_actualizar_donacion_inventario (
    IN p_id_donacion INT, IN p_cantidad DECIMAL(10,2), IN p_descripcion VARCHAR(150),
    IN p_subtipo_donacion VARCHAR(50), IN p_id_actividad INT, IN p_donacion_anonima TINYINT,
    IN p_donante_tipo VARCHAR(20), IN p_donante_nombre VARCHAR(150), IN p_donante_correo VARCHAR(100),
    IN p_donante_telefono VARCHAR(30), IN p_donante_dni VARCHAR(20), IN p_donante_ruc VARCHAR(20),
    IN p_id_usuario_edicion INT, IN p_motivo_edicion VARCHAR(255)
)
sp_block: BEGIN
    DECLARE v_tipo INT DEFAULT NULL;
    DECLARE v_id_donante INT DEFAULT NULL;
    DECLARE v_tipo_donante VARCHAR(20) DEFAULT NULL;

    SELECT id_tipo_donacion INTO v_tipo
    FROM donacion
    WHERE id_donacion = p_id_donacion
      AND COALESCE(estado, 'ACTIVO') != 'ANULADO'
    LIMIT 1;

    IF v_tipo IS NULL THEN
        SELECT 0 AS filas_afectadas;
        LEAVE sp_block;
    END IF;

    IF v_tipo = 1 AND (p_cantidad IS NULL OR p_cantidad <= 0) THEN
        SELECT 0 AS filas_afectadas;
        LEAVE sp_block;
    END IF;

    UPDATE donacion
    SET cantidad = CASE WHEN v_tipo = 1 THEN p_cantidad ELSE cantidad END,
        descripcion = p_descripcion,
        subtipo_donacion = NULLIF(TRIM(p_subtipo_donacion),''),
        id_actividad = p_id_actividad,
        actualizado_en = NOW()
    WHERE id_donacion = p_id_donacion;

    IF IFNULL(p_donacion_anonima, 0) = 1 THEN
        DELETE FROM donacion_donante WHERE id_donacion = p_id_donacion;
    ELSE
        IF p_donante_nombre IS NULL OR TRIM(p_donante_nombre) = '' THEN
            SELECT 0 AS filas_afectadas;
            LEAVE sp_block;
        END IF;

        SET v_tipo_donante = CASE UPPER(TRIM(IFNULL(p_donante_tipo, 'PERSONA')))
            WHEN 'EMPRESA' THEN 'Empresa' WHEN 'GRUPO' THEN 'Grupo' ELSE 'Persona'
        END;

        SELECT dnt.id_donante INTO v_id_donante FROM donante dnt
        WHERE LOWER(TRIM(dnt.nombre)) = LOWER(TRIM(p_donante_nombre))
          AND dnt.tipo = v_tipo_donante
          AND (IFNULL(TRIM(dnt.correo),'') = IFNULL(TRIM(p_donante_correo),'')
            OR IFNULL(TRIM(dnt.telefono),'') = IFNULL(TRIM(p_donante_telefono),'')
            OR IFNULL(TRIM(dnt.dni),'') = IFNULL(TRIM(p_donante_dni),''))
        LIMIT 1;

        IF v_id_donante IS NULL THEN
            INSERT INTO donante(tipo, nombre, correo, telefono, dni, ruc)
            VALUES(v_tipo_donante, TRIM(p_donante_nombre), NULLIF(TRIM(p_donante_correo),''),
                   NULLIF(TRIM(p_donante_telefono),''), NULLIF(TRIM(p_donante_dni),''), NULLIF(TRIM(p_donante_ruc),''));
            SET v_id_donante = LAST_INSERT_ID();
        END IF;

        DELETE FROM donacion_donante WHERE id_donacion = p_id_donacion;
        INSERT INTO donacion_donante(id_donacion, id_donante) VALUES(p_id_donacion, v_id_donante);
    END IF;

    SELECT 1 AS filas_afectadas;
END$$

-- -------------------------------------------------------
-- sp_anular_donacion_inventario
-- -------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_anular_donacion_inventario$$
CREATE PROCEDURE sp_anular_donacion_inventario (
    IN p_id_donacion INT, IN p_id_usuario_anula INT, IN p_motivo VARCHAR(255)
)
sp_block: BEGIN
    DECLARE v_tipo INT DEFAULT NULL;
    DECLARE v_item INT DEFAULT NULL;
    DECLARE v_cantidad DECIMAL(10,2) DEFAULT 0;
    DECLARE v_stock_anterior DECIMAL(10,2) DEFAULT 0;
    DECLARE v_stock_nuevo DECIMAL(10,2) DEFAULT 0;

    SELECT id_tipo_donacion INTO v_tipo FROM donacion WHERE id_donacion = p_id_donacion LIMIT 1;

    IF v_tipo IS NULL THEN LEAVE sp_block; END IF;

    IF EXISTS (SELECT 1 FROM donacion WHERE id_donacion = p_id_donacion AND COALESCE(estado,'ACTIVO') = 'ANULADO') THEN
        LEAVE sp_block;
    END IF;

    IF v_tipo = 2 THEN
        SELECT id_item, cantidad INTO v_item, v_cantidad FROM donacion_detalle
        WHERE id_donacion = p_id_donacion LIMIT 1;

        IF v_item IS NOT NULL AND v_cantidad IS NOT NULL AND v_cantidad > 0 THEN
            SELECT stock_actual INTO v_stock_anterior FROM inventario_item WHERE id_item = v_item LIMIT 1;

            IF v_stock_anterior >= v_cantidad THEN
                SET v_stock_nuevo = v_stock_anterior - v_cantidad;
                UPDATE inventario_item SET stock_actual = v_stock_nuevo, actualizado_en = NOW() WHERE id_item = v_item;
                INSERT INTO inventario_movimiento(id_item, tipo_movimiento, motivo, cantidad, stock_anterior, stock_nuevo,
                    id_referencia, tabla_referencia, observacion, id_usuario, creado_en)
                VALUES(v_item, 'SALIDA', 'ANULACION_DONACION', v_cantidad, v_stock_anterior, v_stock_nuevo,
                    p_id_donacion, 'donacion', CONCAT('Anulacion de donacion #', p_id_donacion, '. ', IFNULL(p_motivo,'')), p_id_usuario_anula, NOW());
            END IF;
        END IF;
    END IF;

    UPDATE donacion SET estado = 'ANULADO', anulado_en = NOW(), id_usuario_anula = p_id_usuario_anula,
        motivo_anulacion = LEFT(IFNULL(p_motivo,'Anulacion manual'), 255), actualizado_en = NOW()
    WHERE id_donacion = p_id_donacion;
END$$

-- -------------------------------------------------------
-- sp_registrar_donacion_inventario
-- -------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_registrar_donacion_inventario$$
CREATE PROCEDURE sp_registrar_donacion_inventario (
    IN p_cantidad DECIMAL(10,2), IN p_descripcion VARCHAR(150), IN p_id_tipo_donacion INT,
    IN p_subtipo_donacion VARCHAR(50), IN p_id_actividad INT, IN p_id_usuario_registro INT,
    IN p_id_item INT, IN p_crear_nuevo_item TINYINT, IN p_item_nombre VARCHAR(150),
    IN p_item_categoria VARCHAR(50), IN p_item_unidad_medida VARCHAR(30), IN p_item_stock_minimo DECIMAL(10,2),
    IN p_donacion_anonima TINYINT, IN p_donante_tipo VARCHAR(20), IN p_donante_nombre VARCHAR(150),
    IN p_donante_correo VARCHAR(100), IN p_donante_telefono VARCHAR(30), IN p_donante_dni VARCHAR(20),
    IN p_donante_ruc VARCHAR(20)
)
sp_block: BEGIN
    DECLARE v_id_donacion INT DEFAULT 0;
    DECLARE v_id_donante INT DEFAULT NULL;
    DECLARE v_tipo_donante VARCHAR(20) DEFAULT NULL;

    IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
        SELECT 0 AS id_donacion;
        LEAVE sp_block;
    END IF;

    INSERT INTO donacion(cantidad, descripcion, id_tipo_donacion, subtipo_donacion, id_actividad, id_usuario_registro, registrado_en, estado)
    VALUES(p_cantidad, p_descripcion, p_id_tipo_donacion, NULLIF(TRIM(p_subtipo_donacion),''), p_id_actividad, p_id_usuario_registro, NOW(), 'PENDIENTE');
    SET v_id_donacion = LAST_INSERT_ID();

    IF IFNULL(p_donacion_anonima, 0) = 0 THEN
        IF p_donante_nombre IS NULL OR TRIM(p_donante_nombre) = '' THEN
            SELECT v_id_donacion AS id_donacion;
            LEAVE sp_block;
        END IF;

        SET v_tipo_donante = CASE UPPER(TRIM(IFNULL(p_donante_tipo,'PERSONA')))
            WHEN 'EMPRESA' THEN 'Empresa' WHEN 'GRUPO' THEN 'Grupo' ELSE 'Persona'
        END;

        SELECT dnt.id_donante INTO v_id_donante FROM donante dnt
        WHERE LOWER(TRIM(dnt.nombre)) = LOWER(TRIM(p_donante_nombre)) AND dnt.tipo = v_tipo_donante
          AND (IFNULL(TRIM(dnt.correo),'') = IFNULL(TRIM(p_donante_correo),'')
            OR IFNULL(TRIM(dnt.telefono),'') = IFNULL(TRIM(p_donante_telefono),''))
        LIMIT 1;

        IF v_id_donante IS NULL THEN
            INSERT INTO donante(tipo, nombre, correo, telefono, dni, ruc)
            VALUES(v_tipo_donante, TRIM(p_donante_nombre), NULLIF(TRIM(p_donante_correo),''),
                   NULLIF(TRIM(p_donante_telefono),''), NULLIF(TRIM(p_donante_dni),''), NULLIF(TRIM(p_donante_ruc),''));
            SET v_id_donante = LAST_INSERT_ID();
        END IF;

        INSERT INTO donacion_donante(id_donacion, id_donante) VALUES(v_id_donacion, v_id_donante);
    END IF;

    SELECT v_id_donacion AS id_donacion;
END$$

-- -------------------------------------------------------
-- sp_registrar_movimiento_inventario
-- -------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_registrar_movimiento_inventario$$
CREATE PROCEDURE sp_registrar_movimiento_inventario (
    IN p_id_item INT, IN p_tipo_movimiento VARCHAR(20), IN p_motivo VARCHAR(30),
    IN p_cantidad DECIMAL(10,2), IN p_observacion VARCHAR(255), IN p_id_usuario INT
)
sp_block: BEGIN
    DECLARE v_stock_anterior DECIMAL(10,2) DEFAULT 0;
    DECLARE v_stock_nuevo DECIMAL(10,2) DEFAULT 0;
    DECLARE v_tipo VARCHAR(20);

    SET v_tipo = UPPER(TRIM(p_tipo_movimiento));

    IF p_id_item IS NULL OR p_id_item <= 0 THEN SELECT 0 AS stock_actual; LEAVE sp_block; END IF;
    IF p_cantidad IS NULL OR p_cantidad <= 0 THEN SELECT 0 AS stock_actual; LEAVE sp_block; END IF;
    IF v_tipo NOT IN ('ENTRADA','SALIDA') THEN SELECT 0 AS stock_actual; LEAVE sp_block; END IF;

    SELECT stock_actual INTO v_stock_anterior FROM inventario_item WHERE id_item = p_id_item LIMIT 1;

    IF v_tipo = 'ENTRADA' THEN
        SET v_stock_nuevo = v_stock_anterior + p_cantidad;
    ELSE
        IF v_stock_anterior < p_cantidad THEN
            SELECT v_stock_anterior AS stock_actual;
            LEAVE sp_block;
        END IF;
        SET v_stock_nuevo = v_stock_anterior - p_cantidad;
    END IF;

    UPDATE inventario_item SET stock_actual = v_stock_nuevo, actualizado_en = NOW() WHERE id_item = p_id_item;

    INSERT INTO inventario_movimiento(id_item, tipo_movimiento, motivo, cantidad, stock_anterior, stock_nuevo,
        id_referencia, tabla_referencia, observacion, id_usuario, creado_en)
    VALUES(p_id_item, v_tipo, UPPER(TRIM(IFNULL(p_motivo,'MANUAL'))), p_cantidad, v_stock_anterior, v_stock_nuevo,
        NULL, NULL, p_observacion, p_id_usuario, NOW());

    SELECT v_stock_nuevo AS stock_actual;
END$$

DELIMITER ;
