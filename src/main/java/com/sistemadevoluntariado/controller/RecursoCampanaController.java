package com.sistemadevoluntariado.controller;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import com.sistemadevoluntariado.entity.Recurso;
import com.sistemadevoluntariado.entity.Usuario;
import com.sistemadevoluntariado.service.RecursoService;

import jakarta.servlet.http.HttpSession;

/**
 * Gestión de Stock de Recursos.
 * CRUD sobre tabla recurso con cálculo de disponibilidad (stock - asignado).
 */
@Controller
@RequestMapping("/recursos-campana")
public class RecursoCampanaController {

    @Autowired private RecursoService recursoService;

    // ── Vista principal ──
    @GetMapping
    public String vista(Model model, HttpSession session) {
        Usuario usuario = (Usuario) session.getAttribute("usuarioLogeado");
        model.addAttribute("usuario", usuario);
        return "views/recursos-campana/recursos-campana";
    }

    // ── Listar todos con disponibilidad ──
    @GetMapping(params = "accion=listar")
    @ResponseBody
    public List<Recurso> listar() {
        return recursoService.obtenerTodosConDisponibilidad();
    }

    // ── Obtener por ID ──
    @GetMapping(params = "accion=obtener")
    @ResponseBody
    public Object obtener(@RequestParam int id) {
        Recurso r = recursoService.obtenerPorId(id);
        if (r != null) return r;
        return Map.of("error", "Recurso no encontrado");
    }

    // ── Listar tipos ──
    @GetMapping(params = "accion=tipos")
    @ResponseBody
    public List<String> listarTipos() {
        return recursoService.obtenerTipos();
    }

    // ── Registrar ──
    @PostMapping(params = "accion=registrar")
    @ResponseBody
    public Map<String, Object> registrar(@RequestParam String nombre,
                                          @RequestParam(required = false) String unidadMedida,
                                          @RequestParam(required = false) String tipoRecurso,
                                          @RequestParam(required = false) String descripcion,
                                          @RequestParam(required = false, defaultValue = "0") double cantidadTotal) {
        Map<String, Object> resp = new HashMap<>();
        try {
            Recurso r = new Recurso(nombre, unidadMedida, tipoRecurso, descripcion);
            r.setCantidadTotal(cantidadTotal);
            Recurso saved = recursoService.guardar(r);
            resp.put("success", true);
            resp.put("message", "Recurso registrado correctamente");
            resp.put("idRecurso", saved.getIdRecurso());
        } catch (Exception e) {
            resp.put("success", false);
            resp.put("message", "Error: " + e.getMessage());
        }
        return resp;
    }

    // ── Actualizar ──
    @PostMapping(params = "accion=actualizar")
    @ResponseBody
    public Map<String, Object> actualizar(@RequestParam int idRecurso,
                                           @RequestParam String nombre,
                                           @RequestParam(required = false) String unidadMedida,
                                           @RequestParam(required = false) String tipoRecurso,
                                           @RequestParam(required = false) String descripcion,
                                           @RequestParam(required = false, defaultValue = "0") double cantidadTotal) {
        Map<String, Object> resp = new HashMap<>();
        try {
            Recurso r = recursoService.obtenerPorId(idRecurso);
            if (r == null) {
                resp.put("success", false);
                resp.put("message", "Recurso no encontrado");
                return resp;
            }
            r.setNombre(nombre);
            r.setUnidadMedida(unidadMedida);
            r.setTipoRecurso(tipoRecurso);
            r.setDescripcion(descripcion);
            r.setCantidadTotal(cantidadTotal);
            recursoService.guardar(r);
            resp.put("success", true);
            resp.put("message", "Recurso actualizado correctamente");
        } catch (Exception e) {
            resp.put("success", false);
            resp.put("message", "Error: " + e.getMessage());
        }
        return resp;
    }

    // ── Eliminar ──
    @PostMapping(params = "accion=eliminar")
    @ResponseBody
    public Map<String, Object> eliminar(@RequestParam int idRecurso) {
        Map<String, Object> resp = new HashMap<>();
        try {
            recursoService.eliminar(idRecurso);
            resp.put("success", true);
            resp.put("message", "Recurso eliminado correctamente");
        } catch (Exception e) {
            resp.put("success", false);
            resp.put("message", "Error: " + e.getMessage());
        }
        return resp;
    }
}
