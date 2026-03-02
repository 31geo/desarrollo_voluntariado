package com.sistemadevoluntariado.controller;

import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.sistemadevoluntariado.entity.Notificacion;
import com.sistemadevoluntariado.entity.Usuario;
import com.sistemadevoluntariado.service.NotificacionService;

import jakarta.servlet.http.HttpSession;

@RestController
@RequestMapping("/notificaciones")
public class NotificacionController {

    @Autowired
    private NotificacionService notificacionService;

    // ── Listar notificaciones del usuario ──
    @GetMapping(params = "action=listar")
    public Map<String, Object> listar(HttpSession session) {
        Usuario usuario = (Usuario) session.getAttribute("usuarioLogeado");
        if (usuario == null) return Map.of("success", false, "notificaciones", List.of(), "noLeidas", 0);
        List<Notificacion> lista = notificacionService.listarPorUsuario(usuario.getIdUsuario());
        int noLeidas = (int) lista.stream().filter(n -> !n.isLeida()).count();
        Map<String, Object> resp = new java.util.HashMap<>();
        resp.put("success", true);
        resp.put("notificaciones", lista);
        resp.put("noLeidas", noLeidas);
        return resp;
    }

    // ── Contar no leídas ──
    @GetMapping(params = "action=contar")
    public Map<String, Object> contar(HttpSession session) {
        Usuario usuario = (Usuario) session.getAttribute("usuarioLogeado");
        if (usuario == null) return Map.of("noLeidas", 0);
        int cantidad = notificacionService.contarNoLeidas(usuario.getIdUsuario());
        return Map.of("noLeidas", cantidad);
    }

    // ── Eliminar una notificación (al marcarla) ──
    @GetMapping(params = "action=eliminar")
    public Map<String, Object> eliminar(@RequestParam int id) {
        try {
            notificacionService.eliminarNotificacion(id);
            return Map.of("success", true);
        } catch (Exception e) {
            return Map.of("success", false, "message", "Error: " + e.getMessage());
        }
    }

    // ── Eliminar todas (al marcar todas) ──
    @GetMapping(params = "action=eliminarTodas")
    public Map<String, Object> eliminarTodas(HttpSession session) {
        try {
            Usuario usuario = (Usuario) session.getAttribute("usuarioLogeado");
            if (usuario == null) return Map.of("success", false, "message", "Sesión expirada");
            notificacionService.eliminarTodasNotificaciones(usuario.getIdUsuario());
            return Map.of("success", true);
        } catch (Exception e) {
            return Map.of("success", false, "message", "Error: " + e.getMessage());
        }
    }

    // ── Marcar una como leída (retrocompatibilidad) ──
    @GetMapping(params = "action=marcarLeida")
    public Map<String, Object> marcarLeida(@RequestParam int id) {
        try {
            notificacionService.eliminarNotificacion(id);
            return Map.of("success", true);
        } catch (Exception e) {
            return Map.of("success", false, "message", "Error: " + e.getMessage());
        }
    }

    // ── Marcar todas como leídas (retrocompatibilidad) ──
    @GetMapping(params = "action=marcarTodas")
    public Map<String, Object> marcarTodas(HttpSession session) {
        try {
            Usuario usuario = (Usuario) session.getAttribute("usuarioLogeado");
            if (usuario == null) return Map.of("success", false, "message", "Sesión expirada");
            notificacionService.eliminarTodasNotificaciones(usuario.getIdUsuario());
            return Map.of("success", true);
        } catch (Exception e) {
            return Map.of("success", false, "message", "Error: " + e.getMessage());
        }
    }
}
