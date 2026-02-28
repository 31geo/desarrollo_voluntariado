package com.sistemadevoluntariado.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.sistemadevoluntariado.entity.Voluntario;

@Repository
public interface VoluntarioRepository extends JpaRepository<Voluntario, Integer>, VoluntarioRepositoryCustom {

    List<Voluntario> findAllByOrderByIdVoluntarioDesc();

    Optional<Voluntario> findFirstByIdUsuarioOrderByIdVoluntarioDesc(int idUsuario);

    @Query("SELECT v FROM Voluntario v WHERE v.accesoSistema = true AND v.idUsuario IS NULL AND v.cargo <> 'Voluntario' ORDER BY v.nombres ASC")
    List<Voluntario> obtenerVoluntariosConAcceso();

    @Query("SELECT COUNT(v) FROM Voluntario v WHERE v.dni = :dni AND (:idVoluntario IS NULL OR v.idVoluntario != :idVoluntario)")
    int countByDniAndIdNot(@Param("dni") String dni, @Param("idVoluntario") Integer idVoluntario);

    @Query("SELECT COUNT(v) FROM Voluntario v WHERE v.dni = :dni")
    int countByDni(@Param("dni") String dni);

    @Query("SELECT COUNT(v) FROM Voluntario v WHERE v.correo = :correo AND (:idVoluntario IS NULL OR v.idVoluntario != :idVoluntario)")
    int countByCorreoAndIdNot(@Param("correo") String correo, @Param("idVoluntario") Integer idVoluntario);

    @Query("SELECT COUNT(v) FROM Voluntario v WHERE v.correo = :correo")
    int countByCorreo(@Param("correo") String correo);

    @Query("SELECT COUNT(v) FROM Voluntario v WHERE v.telefono = :telefono AND (:idVoluntario IS NULL OR v.idVoluntario != :idVoluntario)")
    int countByTelefonoAndIdNot(@Param("telefono") String telefono, @Param("idVoluntario") Integer idVoluntario);

    @Query("SELECT COUNT(v) FROM Voluntario v WHERE v.telefono = :telefono")
    int countByTelefono(@Param("telefono") String telefono);
}
