DELIMITER $$

CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_crear_usuario`(
    IN `p_nombres` VARCHAR(100),
    IN `p_apellidos` VARCHAR(100),
    IN `p_correo` VARCHAR(100),
    IN `p_username` VARCHAR(60),
    IN `p_dni` VARCHAR(20),
    IN `p_password_hash` VARCHAR(255)
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        -- Manejo de errores: rollback en caso de fallo
        ROLLBACK;
    END;

    START TRANSACTION;

    -- Validar si el usuario ya existe por username, correo o DNI
    IF EXISTS (SELECT 1 FROM usuario WHERE username = p_username OR correo = p_correo OR dni = p_dni) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El usuario, correo o DNI ya existe';
    ELSE
        -- Insertar el nuevo usuario
        INSERT INTO usuario (nombres, apellidos, correo, username, dni, password_hash, estado, creado_en)
        VALUES (p_nombres, p_apellidos, p_correo, p_username, p_dni, p_password_hash, 'ACTIVO', NOW());
    END IF;

    -- Devolver el ID del usuario insertado
    SELECT LAST_INSERT_ID() AS id_usuario;

    COMMIT;
END$$

DELIMITER ;