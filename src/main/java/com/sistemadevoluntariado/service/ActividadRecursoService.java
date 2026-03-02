package com.sistemadevoluntariado.service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sistemadevoluntariado.entity.Actividad;
import com.sistemadevoluntariado.entity.ActividadRecurso;
import com.sistemadevoluntariado.entity.Recurso;
import com.sistemadevoluntariado.repository.ActividadRecursoRepository;
import com.sistemadevoluntariado.repository.RecursoRepository;

@Service
public class ActividadRecursoService {

    @Autowired
    private ActividadRecursoRepository actividadRecursoRepository;

    @Autowired
    private RecursoRepository recursoRepository;

    @Autowired
    private ActividadService actividadService;

    /** Listar TODOS los recursos de todas las actividades (para dashboard) */
    @Transactional
    public List<ActividadRecurso> listarTodos() {
        List<ActividadRecurso> lista = actividadRecursoRepository.findAll();

        // Pre-cargar mapas para evitar N+1
        Map<Integer, Recurso> recursosMap = new HashMap<>();
        recursoRepository.findAll().forEach(r -> recursosMap.put(r.getIdRecurso(), r));

        Map<Integer, String> actividadesMap = new HashMap<>();
        try {
            for (Actividad a : actividadService.obtenerTodasActividades()) {
                actividadesMap.put(a.getIdActividad(), a.getNombre());
            }
        } catch (Exception e) { /* silenciar si no hay actividades */ }

        for (ActividadRecurso ar : lista) {
            Recurso r = recursosMap.get(ar.getIdRecurso());
            if (r != null) {
                ar.setNombreRecurso(r.getNombre());
                ar.setUnidadMedida(r.getUnidadMedida());
                ar.setTipoRecurso(r.getTipoRecurso());
            }
            ar.setNombreActividad(
                actividadesMap.getOrDefault(ar.getIdActividad(), "Actividad #" + ar.getIdActividad()));
        }
        return lista;
    }

    /** Obtener un recurso por ID con datos enriquecidos */
    @Transactional
    public ActividadRecurso obtenerPorId(int id) {
        ActividadRecurso ar = actividadRecursoRepository.findById(id).orElse(null);
        if (ar != null) {
            recursoRepository.findById(ar.getIdRecurso()).ifPresent(r -> {
                ar.setNombreRecurso(r.getNombre());
                ar.setUnidadMedida(r.getUnidadMedida());
                ar.setTipoRecurso(r.getTipoRecurso());
            });
            try {
                Actividad a = actividadService.obtenerActividadPorId(ar.getIdActividad());
                if (a != null) ar.setNombreActividad(a.getNombre());
            } catch (Exception e) { /* silenciar */ }
        }
        return ar;
    }

    @Transactional(readOnly = true)
    public List<ActividadRecurso> obtenerPorActividad(int idActividad) {
        List<ActividadRecurso> lista = actividadRecursoRepository.obtenerPorActividad(idActividad);
        // Enriquecer con datos del recurso
        for (ActividadRecurso ar : lista) {
            recursoRepository.findById(ar.getIdRecurso()).ifPresent(r -> {
                ar.setNombreRecurso(r.getNombre());
                ar.setUnidadMedida(r.getUnidadMedida());
                ar.setTipoRecurso(r.getTipoRecurso());
            });
        }
        return lista;
    }

    @Transactional
    public ActividadRecurso guardar(ActividadRecurso ar) {
        return actividadRecursoRepository.save(ar);
    }

    @Transactional
    public void eliminar(int id) {
        actividadRecursoRepository.eliminarPorId(id);
    }

    @Transactional
    public ActividadRecurso actualizarConseguida(int id, double cantidad) {
        ActividadRecurso ar = actividadRecursoRepository.findById(id).orElse(null);
        if (ar != null) {
            ar.setCantidadConseguida(cantidad);
            return actividadRecursoRepository.save(ar);
        }
        return null;
    }
}
