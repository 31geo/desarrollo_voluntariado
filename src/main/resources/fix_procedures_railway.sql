-- =====================================================================
-- CORRECCIÓN: Eliminar START TRANSACTION/COMMIT/ROLLBACK internos
-- de los procedimientos que son llamados desde Spring @Transactional.
-- Spring maneja la transacción; los procedimientos no deben hacerlo.
-- =====================================================================

DELIMITER $$

-- --------------------------------------------------------
-- 1. sp_crear_usuario
-- --------------------------------------------------------
DROP PROCEDURE IF EXISTS `sp_crear_usuario`$$
CREATE PROCEDURE `sp_crear_usuario` (
    IN `p_nombres` VARCHAR(100),
    IN `p_apellidos` VARCHAR(100),
    IN `p_correo` VARCHAR(100),
    IN `p_username` VARCHAR(60),
    IN `p_dni` VARCHAR(20),
    IN `p_password_hash` VARCHAR(255)
)
BEGIN
    IF EXISTS (SELECT 1 FROM usuario WHERE username = p_username OR correo = p_correo OR dni = p_dni) THEN
        -- Devolver 0 para indicar que ya existe (sin lanzar excepcion que marcaría rollback-only en Hibernate)
        SELECT 0 AS id_usuario;
    ELSE
        INSERT INTO usuario (nombres, apellidos, correo, username, dni, password_hash, estado, creado_en)
        VALUES (p_nombres, p_apellidos, p_correo, p_username, p_dni, p_password_hash, 'ACTIVO', NOW());
        SELECT LAST_INSERT_ID() AS id_usuario;
    END IF;
END$$

-- --------------------------------------------------------
-- 2. sp_actualizar_donacion_inventario
-- --------------------------------------------------------
DROP PROCEDURE IF EXISTS `sp_actualizar_donacion_inventario`$$
CREATE PROCEDURE `sp_actualizar_donacion_inventario` (
    IN `p_id_donacion` INT,
    IN `p_cantidad` DECIMAL(10,2),
    IN `p_descripcion` VARCHAR(150),
    IN `p_subtipo_donacion` VARCHAR(50),
    IN `p_id_actividad` INT,
    IN `p_donacion_anonima` TINYINT,
    IN `p_donante_tipo` VARCHAR(20),
    IN `p_donante_nombre` VARCHAR(150),
    IN `p_donante_correo` VARCHAR(100),
    IN `p_donante_telefono` VARCHAR(30),
    IN `p_donante_dni` VARCHAR(20),
    IN `p_donante_ruc` VARCHAR(20),
    IN `p_id_usuario_edicion` INT,
    IN `p_motivo_edicion` VARCHAR(255)
)
BEGIN
    DECLARE v_tipo INT;
    DECLARE v_id_donante INT DEFAULT NULL;
    DECLARE v_tipo_donante VARCHAR(20) DEFAULT NULL;

    SELECT id_tipo_donacion INTO v_tipo
    FROM donacion
    WHERE id_donacion = p_id_donacion
      AND COALESCE(estado, 'ACTIVO') = 'ACTIVO'
    FOR UPDATE;

    IF v_tipo IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La donacion no existe o ya fue anulada.';
    END IF;

    IF v_tipo = 1 THEN
        IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El monto para donaciones de dinero debe ser mayor a cero.';
        END IF;
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
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Debe indicar el nombre del donante o marcar donacion anonima.';
        END IF;

        SET v_tipo_donante = CASE UPPER(TRIM(IFNULL(p_donante_tipo, 'PERSONA')))
            WHEN 'EMPRESA' THEN 'Empresa'
            WHEN 'GRUPO' THEN 'Grupo'
            ELSE 'Persona'
        END;

        SELECT dnt.id_donante INTO v_id_donante
        FROM donante dnt
        WHERE LOWER(TRIM(dnt.nombre)) = LOWER(TRIM(p_donante_nombre))
          AND dnt.tipo = v_tipo_donante
          AND (
                IFNULL(TRIM(dnt.correo), '') = IFNULL(TRIM(p_donante_correo), '')
                OR IFNULL(TRIM(dnt.telefono), '') = IFNULL(TRIM(p_donante_telefono), '')
                OR IFNULL(TRIM(dnt.dni), '') = IFNULL(TRIM(p_donante_dni), '')
          )
        LIMIT 1;

        IF v_id_donante IS NULL THEN
            INSERT INTO donante(tipo, nombre, correo, telefono, dni, ruc)
            VALUES(v_tipo_donante, TRIM(p_donante_nombre), NULLIF(TRIM(p_donante_correo), ''), NULLIF(TRIM(p_donante_telefono), ''), NULLIF(TRIM(p_donante_dni), ''), NULLIF(TRIM(p_donante_ruc), ''));
            SET v_id_donante = LAST_INSERT_ID();
        END IF;

        DELETE FROM donacion_donante WHERE id_donacion = p_id_donacion;
        INSERT INTO donacion_donante(id_donacion, id_donante) VALUES(p_id_donacion, v_id_donante);
    END IF;

    SELECT ROW_COUNT() AS filas_afectadas;
END$$

-- --------------------------------------------------------
-- 3. sp_anular_donacion_inventario
-- --------------------------------------------------------
DROP PROCEDURE IF EXISTS `sp_anular_donacion_inventario`$$
CREATE PROCEDURE `sp_anular_donacion_inventario` (
    IN `p_id_donacion` INT,
    IN `p_id_usuario_anula` INT,
    IN `p_motivo` VARCHAR(255)
)
BEGIN
    DECLARE v_tipo INT;
    DECLARE v_item INT;
    DECLARE v_cantidad DECIMAL(10,2);
    DECLARE v_stock_anterior DECIMAL(10,2) DEFAULT 0;
    DECLARE v_stock_nuevo DECIMAL(10,2) DEFAULT 0;

    SELECT id_tipo_donacion
    INTO v_tipo
    FROM donacion
    WHERE id_donacion = p_id_donacion
    FOR UPDATE;

    IF v_tipo IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La donacion no existe.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM donacion
        WHERE id_donacion = p_id_donacion
          AND COALESCE(estado, 'ACTIVO') = 'ANULADO'
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La donacion ya esta anulada.';
    END IF;

    IF v_tipo = 2 THEN
        SELECT id_item, cantidad
        INTO v_item, v_cantidad
        FROM donacion_detalle
        WHERE id_donacion = p_id_donacion
        LIMIT 1;

        IF v_item IS NOT NULL AND v_cantidad IS NOT NULL AND v_cantidad > 0 THEN
            SELECT stock_actual INTO v_stock_anterior
            FROM inventario_item
            WHERE id_item = v_item
            FOR UPDATE;

            IF v_stock_anterior < v_cantidad THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No hay stock suficiente para revertir la donacion.';
            END IF;

            SET v_stock_nuevo = v_stock_anterior - v_cantidad;

            UPDATE inventario_item
            SET stock_actual = v_stock_nuevo,
                actualizado_en = NOW()
            WHERE id_item = v_item;

            INSERT INTO inventario_movimiento(
                id_item, tipo_movimiento, motivo, cantidad, stock_anterior, stock_nuevo,
                id_referencia, tabla_referencia, observacion, id_usuario, creado_en
            ) VALUES(
                v_item, 'SALIDA', 'ANULACION_DONACION', v_cantidad, v_stock_anterior, v_stock_nuevo,
                p_id_donacion, 'donacion', CONCAT('Anulacion de donacion #', p_id_donacion, '. ', IFNULL(p_motivo, '')), p_id_usuario_anula, NOW()
            );
        END IF;
    END IF;

    UPDATE donacion
    SET estado = 'ANULADO',
        anulado_en = NOW(),
        id_usuario_anula = p_id_usuario_anula,
        motivo_anulacion = LEFT(IFNULL(p_motivo, 'Anulacion manual'), 255),
        actualizado_en = NOW()
    WHERE id_donacion = p_id_donacion;
END$$

-- --------------------------------------------------------
-- 4. sp_registrar_donacion_inventario
-- --------------------------------------------------------
DROP PROCEDURE IF EXISTS `sp_registrar_donacion_inventario`$$
CREATE PROCEDURE `sp_registrar_donacion_inventario` (
    IN `p_cantidad` DECIMAL(10,2),
    IN `p_descripcion` VARCHAR(150),
    IN `p_id_tipo_donacion` INT,
    IN `p_subtipo_donacion` VARCHAR(50),
    IN `p_id_actividad` INT,
    IN `p_id_usuario_registro` INT,
    IN `p_id_item` INT,
    IN `p_crear_nuevo_item` TINYINT,
    IN `p_item_nombre` VARCHAR(150),
    IN `p_item_categoria` VARCHAR(50),
    IN `p_item_unidad_medida` VARCHAR(30),
    IN `p_item_stock_minimo` DECIMAL(10,2),
    IN `p_donacion_anonima` TINYINT,
    IN `p_donante_tipo` VARCHAR(20),
    IN `p_donante_nombre` VARCHAR(150),
    IN `p_donante_correo` VARCHAR(100),
    IN `p_donante_telefono` VARCHAR(30),
    IN `p_donante_dni` VARCHAR(20),
    IN `p_donante_ruc` VARCHAR(20)
)
BEGIN
    DECLARE v_id_donacion INT;
    DECLARE v_id_donante INT DEFAULT NULL;
    DECLARE v_tipo_donante VARCHAR(20) DEFAULT NULL;

    IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cantidad/monto de donacion debe ser mayor a cero.';
    END IF;

    INSERT INTO donacion(cantidad, descripcion, id_tipo_donacion, subtipo_donacion, id_actividad, id_usuario_registro, registrado_en, estado)
    VALUES(p_cantidad, p_descripcion, p_id_tipo_donacion, NULLIF(TRIM(p_subtipo_donacion),''), p_id_actividad, p_id_usuario_registro, NOW(), 'PENDIENTE');
    SET v_id_donacion = LAST_INSERT_ID();

    IF IFNULL(p_donacion_anonima, 0) = 0 THEN
        IF p_donante_nombre IS NULL OR TRIM(p_donante_nombre) = '' THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Debe indicar el nombre del donante o marcar donacion anonima.';
        END IF;

        SET v_tipo_donante = CASE UPPER(TRIM(IFNULL(p_donante_tipo, 'PERSONA')))
            WHEN 'EMPRESA' THEN 'Empresa'
            WHEN 'GRUPO' THEN 'Grupo'
            ELSE 'Persona'
        END;

        SELECT dnt.id_donante INTO v_id_donante
        FROM donante dnt
        WHERE LOWER(TRIM(dnt.nombre)) = LOWER(TRIM(p_donante_nombre))
          AND dnt.tipo = v_tipo_donante
          AND (IFNULL(TRIM(dnt.correo), '') = IFNULL(TRIM(p_donante_correo), '') OR IFNULL(TRIM(dnt.telefono), '') = IFNULL(TRIM(p_donante_telefono), ''))
        LIMIT 1;

        IF v_id_donante IS NULL THEN
            INSERT INTO donante(tipo, nombre, correo, telefono, dni, ruc)
            VALUES(v_tipo_donante, TRIM(p_donante_nombre), NULLIF(TRIM(p_donante_correo), ''), NULLIF(TRIM(p_donante_telefono), ''), NULLIF(TRIM(p_donante_dni), ''), NULLIF(TRIM(p_donante_ruc), ''));
            SET v_id_donante = LAST_INSERT_ID();
        END IF;

        INSERT INTO donacion_donante(id_donacion, id_donante) VALUES(v_id_donacion, v_id_donante);
    END IF;

    SELECT v_id_donacion AS id_donacion;
END$$

-- --------------------------------------------------------
-- 5. sp_registrar_movimiento_inventario
-- --------------------------------------------------------
DROP PROCEDURE IF EXISTS `sp_registrar_movimiento_inventario`$$
CREATE PROCEDURE `sp_registrar_movimiento_inventario` (
    IN `p_id_item` INT,
    IN `p_tipo_movimiento` VARCHAR(20),
    IN `p_motivo` VARCHAR(30),
    IN `p_cantidad` DECIMAL(10,2),
    IN `p_observacion` VARCHAR(255),
    IN `p_id_usuario` INT
)
BEGIN
    DECLARE v_stock_anterior DECIMAL(10,2) DEFAULT 0;
    DECLARE v_stock_nuevo DECIMAL(10,2) DEFAULT 0;
    DECLARE v_tipo VARCHAR(20);

    SET v_tipo = UPPER(TRIM(p_tipo_movimiento));

    IF p_id_item IS NULL OR p_id_item <= 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Debe seleccionar un item de inventario valido.';
    END IF;

    IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La cantidad del movimiento debe ser mayor a cero.';
    END IF;

    IF v_tipo NOT IN ('ENTRADA', 'SALIDA') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Tipo de movimiento invalido. Use ENTRADA o SALIDA.';
    END IF;

    SELECT stock_actual INTO v_stock_anterior
    FROM inventario_item
    WHERE id_item = p_id_item
    FOR UPDATE;

    IF v_tipo = 'ENTRADA' THEN
        SET v_stock_nuevo = v_stock_anterior + p_cantidad;
    ELSE
        IF v_stock_anterior < p_cantidad THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Stock insuficiente para registrar la salida.';
        END IF;
        SET v_stock_nuevo = v_stock_anterior - p_cantidad;
    END IF;

    UPDATE inventario_item
    SET stock_actual = v_stock_nuevo,
        actualizado_en = NOW()
    WHERE id_item = p_id_item;

    INSERT INTO inventario_movimiento(
        id_item, tipo_movimiento, motivo, cantidad, stock_anterior, stock_nuevo,
        id_referencia, tabla_referencia, observacion, id_usuario, creado_en
    ) VALUES(
        p_id_item, v_tipo, UPPER(TRIM(IFNULL(p_motivo, 'MANUAL'))), p_cantidad, v_stock_anterior, v_stock_nuevo,
        NULL, NULL, p_observacion, p_id_usuario, NOW()
    );

    SELECT v_stock_nuevo AS stock_actual;
END$$

DELIMITER ;
