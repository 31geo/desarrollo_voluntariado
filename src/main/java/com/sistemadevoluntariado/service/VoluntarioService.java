package com.sistemadevoluntariado.service;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sistemadevoluntariado.entity.Voluntario;
import com.sistemadevoluntariado.repository.VoluntarioRepository;

@Service
public class VoluntarioService {

    @Autowired
    private VoluntarioRepository voluntarioRepository;

    @Transactional
    public List<Voluntario> obtenerTodosVoluntarios() {
        return voluntarioRepository.findAllByOrderByIdVoluntarioDesc();
    }

    @Transactional
    public Voluntario obtenerVoluntarioPorId(int id) {
        return voluntarioRepository.findById(id).orElse(null);
    }

    @Transactional
    public Voluntario obtenerVoluntarioPorUsuarioId(int idUsuario) {
        return voluntarioRepository.findFirstByIdUsuarioOrderByIdVoluntarioDesc(idUsuario).orElse(null);
    }

    @Transactional
    public List<Voluntario> obtenerVoluntariosConAcceso() {
        return voluntarioRepository.obtenerVoluntariosConAcceso();
    }

    @Transactional
    public List<Voluntario> obtenerVoluntariosConAsistencia() {
        return voluntarioRepository.obtenerVoluntariosConAsistencia();
    }

    @Transactional
    public boolean crearVoluntario(Voluntario voluntario) {
        return voluntarioRepository.crearVoluntario(voluntario);
    }

    @Transactional
    public boolean actualizarVoluntario(Voluntario voluntario) {
        return voluntarioRepository.actualizarVoluntario(voluntario);
    }

    @Transactional
    public boolean cambiarEstado(int id, String estado) {
        return voluntarioRepository.cambiarEstado(id, estado);
    }

    @Transactional
    public boolean eliminarVoluntario(int id) {
        return voluntarioRepository.eliminarVoluntario(id);
    }

    @Transactional
    public boolean existeDni(String dni, Integer idVoluntario) {
        if (idVoluntario != null) {
            return voluntarioRepository.countByDniAndIdNot(dni, idVoluntario) > 0;
        }
        return voluntarioRepository.countByDni(dni) > 0;
    }

    @Transactional
    public boolean existeCorreo(String correo, Integer idVoluntario) {
        if (idVoluntario != null) {
            return voluntarioRepository.countByCorreoAndIdNot(correo, idVoluntario) > 0;
        }
        return voluntarioRepository.countByCorreo(correo) > 0;
    }

    @Transactional
    public boolean existeTelefono(String telefono, Integer idVoluntario) {
        if (idVoluntario != null) {
            return voluntarioRepository.countByTelefonoAndIdNot(telefono, idVoluntario) > 0;
        }
        return voluntarioRepository.countByTelefono(telefono) > 0;
    }

    @Transactional
    public List<Voluntario> buscarVoluntarios(String nombres, String apellidos, String dni, String correo, String telefono, String carrera, String cargo) {
        return voluntarioRepository.buscarVoluntarios(nombres, apellidos, dni, correo, telefono, carrera, cargo);
    }
}
