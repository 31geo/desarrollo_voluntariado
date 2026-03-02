package com.sistemadevoluntariado.controller;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import com.sistemadevoluntariado.entity.Calendario;
import com.sistemadevoluntariado.entity.Usuario;
import com.sistemadevoluntariado.service.CalendarioService;
import com.sistemadevoluntariado.service.NotificacionService;

import jakarta.servlet.http.HttpSession;

@Controller
@RequestMapping("/calendario")
public class CalendarioController {

    @Autowired
    private CalendarioService calendarioService;

    @Autowired
    private NotificacionService notificacionService;

    /* ───── Vista principal ───── */
    @GetMapping
    public String vista() {
        return "views/calendario/calendario";
    }

    /* ───── REST: listar eventos para FullCalendar ───── */
    @GetMapping(params = "accion=listar")
    @ResponseBody
    public List<Map<String, Object>> listar() {
        List<Calendario> eventos = calendarioService.listarEventos();
        List<Map<String, Object>> fcEventos = new ArrayList<>();
        for (Calendario ev : eventos) {
            Map<String, Object> m = new HashMap<>();
            m.put("id", ev.getIdEvento());
            m.put("title", ev.getTitulo());
            m.put("start", ev.getFechaInicio());
            m.put("end", ev.getFechaFin());
            m.put("color", ev.getColor() != null ? ev.getColor() : "#6366f1");
            m.put("description", ev.getDescripcion());
            fcEventos.add(m);
        }
        return fcEventos;
    }

    /* ───── REST: guardar evento ───── */
    @PostMapping(params = "accion=guardar")
    @ResponseBody
    public String guardar(@RequestBody Calendario c, HttpSession session) {
        Usuario u = (Usuario) session.getAttribute("usuarioLogeado");
        c.setIdUsuario(u.getIdUsuario());
        boolean ok = calendarioService.crearEvento(c);
        if (ok && c.getFechaInicio() != null) {
            try {
                // Notificar si el día quedó con 3 o más eventos
                String fecha = c.getFechaInicio().toString().substring(0, 10);
                notificacionService.generarNotifDiaLleno(u.getIdUsuario(), fecha);
            } catch (Exception ignored) {}
        }
        return ok ? "ok" : "error";
    }
}
