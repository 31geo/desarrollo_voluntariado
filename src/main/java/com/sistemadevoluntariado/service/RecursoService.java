package com.sistemadevoluntariado.service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sistemadevoluntariado.entity.Recurso;
import com.sistemadevoluntariado.repository.RecursoRepository;

@Service
public class RecursoService {

    @Autowired
    private RecursoRepository recursoRepository;

    @Transactional(readOnly = true)
    public List<Recurso> obtenerTodos() {
        return recursoRepository.obtenerTodos();
    }

    /** Obtiene todos los recursos CON disponibilidad calculada */
    @Transactional(readOnly = true)
    public List<Recurso> obtenerTodosConDisponibilidad() {
        List<Recurso> recursos = recursoRepository.obtenerTodos();

        // Mapa: idRecurso → suma de cantidad_requerida asignada
        Map<Integer, Double> asignacionesMap = new HashMap<>();
        for (Object[] row : recursoRepository.obtenerAsignaciones()) {
            int idRecurso = ((Number) row[0]).intValue();
            double suma = ((Number) row[1]).doubleValue();
            asignacionesMap.put(idRecurso, suma);
        }

        for (Recurso r : recursos) {
            double asignado = asignacionesMap.getOrDefault(r.getIdRecurso(), 0.0);
            r.setAsignado(asignado);
            r.setDisponible(Math.max(0, r.getCantidadTotal() - asignado));
        }
        return recursos;
    }

    @Transactional(readOnly = true)
    public Recurso obtenerPorId(int id) {
        return recursoRepository.findById(id).orElse(null);
    }

    @Transactional(readOnly = true)
    public List<String> obtenerTipos() {
        return recursoRepository.obtenerTipos();
    }

    @Transactional
    public Recurso guardar(Recurso recurso) {
        return recursoRepository.save(recurso);
    }

    @Transactional
    public void eliminar(int id) {
        recursoRepository.deleteById(id);
    }
}
