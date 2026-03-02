package com.sistemadevoluntariado.controller;

import java.time.LocalDate;
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

import com.sistemadevoluntariado.entity.Actividad;
import com.sistemadevoluntariado.entity.ActividadLugar;
import com.sistemadevoluntariado.entity.Lugar;
import com.sistemadevoluntariado.entity.Usuario;
import com.sistemadevoluntariado.repository.ActividadLugarRepository;
import com.sistemadevoluntariado.repository.ActividadRepository;
import com.sistemadevoluntariado.service.ActividadService;
import com.sistemadevoluntariado.service.LugarService;

import jakarta.servlet.http.HttpSession;

@Controller
@RequestMapping("/actividades")
public class ActividadController {

    @Autowired
    private ActividadService actividadService;

    @Autowired
    private LugarService lugarService;

    @Autowired
    private ActividadRepository actividadRepository;

    @Autowired
    private ActividadLugarRepository actividadLugarRepository;

    /* ───── Vista principal ───── */
    @GetMapping
    public String vista(Model model, HttpSession session) {
        Usuario usuario = (Usuario) session.getAttribute("usuarioLogeado");
        if (usuario == null) return "redirect:/login";
        model.addAttribute("usuario", usuario);
        model.addAttribute("actividades", actividadService.obtenerTodasActividades());
        return "views/actividades/listar";
    }

    /* ───── REST: listar JSON ───── */
    @GetMapping(params = "action=listar")
    @ResponseBody
    public List<Actividad> listar() {
        return actividadService.obtenerTodasActividades();
    }

    /* ───── REST: obtener por ID ───── */
    @GetMapping(params = "action=obtener")
    @ResponseBody
    public Actividad obtener(@RequestParam int id) {
        return actividadService.obtenerActividadPorId(id);
    }

    /* ───── REST: crear ───── */
    @PostMapping(params = "action=crear")
    @ResponseBody
    public Map<String, Object> crear(@RequestParam String nombre,
                                     @RequestParam(required = false) String descripcion,
                                     @RequestParam String fechaInicio,
                                     @RequestParam(required = false) String fechaFin,
                                     @RequestParam String ubicacion,
                                     @RequestParam int cupoMaximo,
                                     HttpSession session) {
        try {
            Usuario usuario = (Usuario) session.getAttribute("usuarioLogeado");
            if (usuario == null) return Map.of("success", false, "message", "No autorizado");

            LocalDate fi = LocalDate.parse(fechaInicio);
            LocalDate ff = (fechaFin != null && !fechaFin.isEmpty()) ? LocalDate.parse(fechaFin) : null;

            Actividad a = new Actividad(nombre, descripcion, fi, ff, ubicacion, cupoMaximo);
            a.setIdUsuario(usuario.getIdUsuario());

            boolean ok = actividadService.crearActividad(a);
            if (ok && ubicacion != null && !ubicacion.isBlank()) {
                // Buscar la actividad recién creada (última por ID del usuario)
                try {
                    List<Actividad> todas = actividadService.obtenerTodasActividades();
                    Actividad nueva = todas.stream()
                            .filter(act -> act.getNombre().equals(nombre) && 
                                           act.getIdUsuario() != null &&
                                           act.getIdUsuario() == usuario.getIdUsuario())
                            .max((a1, a2) -> Integer.compare(a1.getIdActividad(), a2.getIdActividad()))
                            .orElse(null);
                    if (nueva != null) {
                        Lugar lugar = crearLugarDesdeUbicacion(ubicacion);
                        if (lugar != null) {
                            ActividadLugar al = new ActividadLugar();
                            al.setIdActividad(nueva.getIdActividad());
                            al.setIdLugar(lugar.getIdLugar());
                            actividadLugarRepository.save(al);
                        }
                    }
                } catch (Exception ignored) {}
            }
            return ok ? Map.of("success", true, "message", "Actividad creada correctamente")
                      : Map.of("success", false, "message", "Error al crear la actividad");
        } catch (Exception e) {
            return Map.of("success", false, "message", "Error: " + e.getMessage());
        }
    }

    /* ───── REST: editar / actualizar ───── */
    @PostMapping(params = "action=editar")
    @ResponseBody
    public Map<String, Object> editar(@RequestParam int id,
                                      @RequestParam String nombre,
                                      @RequestParam(required = false) String descripcion,
                                      @RequestParam String fechaInicio,
                                      @RequestParam(required = false) String fechaFin,
                                      @RequestParam String ubicacion,
                                      @RequestParam int cupoMaximo) {
        try {
            Actividad a = new Actividad();
            a.setIdActividad(id);
            a.setNombre(nombre);
            a.setDescripcion(descripcion);
            a.setFechaInicio(fechaInicio != null && !fechaInicio.isEmpty() ? LocalDate.parse(fechaInicio) : null);
            a.setFechaFin(fechaFin != null && !fechaFin.isEmpty() ? LocalDate.parse(fechaFin) : null);
            a.setUbicacion(ubicacion);
            a.setCupoMaximo(cupoMaximo);

            boolean ok = actividadService.actualizarActividad(a);
            return ok ? Map.of("success", true, "message", "Actividad actualizada correctamente")
                      : Map.of("success", false, "message", "Error al actualizar la actividad");
        } catch (Exception e) {
            return Map.of("success", false, "message", "Error: " + e.getMessage());
        }
    }

    @PostMapping(params = "action=actualizar")
    @ResponseBody
    public Map<String, Object> actualizar(@RequestParam int id,
                                          @RequestParam String nombre,
                                          @RequestParam(required = false) String descripcion,
                                          @RequestParam String fechaInicio,
                                          @RequestParam(required = false) String fechaFin,
                                          @RequestParam String ubicacion,
                                          @RequestParam int cupoMaximo) {
        return editar(id, nombre, descripcion, fechaInicio, fechaFin, ubicacion, cupoMaximo);
    }

    /* ───── REST: cambiar estado ───── */
    @PostMapping(params = "action=cambiarEstado")
    @ResponseBody
    public Map<String, Object> cambiarEstado(@RequestParam int id, @RequestParam String estado) {
        boolean ok = actividadService.cambiarEstado(id, estado);
        return ok ? Map.of("success", true, "message", "Estado actualizado correctamente")
                  : Map.of("success", false, "message", "Error al cambiar estado");
    }

    /* ───── REST: eliminar ───── */
    @PostMapping(params = "action=eliminar")
    @ResponseBody
    public Map<String, Object> eliminar(@RequestParam int id) {
        boolean ok = actividadService.eliminarActividad(id);
        return ok ? Map.of("success", true, "message", "Actividad eliminada correctamente")
                  : Map.of("success", false, "message", "Error al eliminar la actividad");
    }

    /* ───── Helper: crear Lugar automático desde ubicación ───── */
    private Lugar crearLugarDesdeUbicacion(String ubicacion) {
        try {
            String[] partes = ubicacion.split(",");
            String departamento = "";
            String provincia = "";
            String distrito = "";
            String direccionRef = "";

            if (partes.length >= 3) {
                departamento = partes[partes.length - 1].trim();
                provincia = partes[partes.length - 2].trim();
                distrito = partes[partes.length - 3].trim();
                StringBuilder sb = new StringBuilder();
                for (int i = 0; i < partes.length - 3; i++) {
                    if (!sb.isEmpty()) sb.append(", ");
                    sb.append(partes[i].trim());
                }
                direccionRef = sb.toString();
            } else if (partes.length == 2) {
                distrito = partes[1].trim();
                direccionRef = partes[0].trim();
            } else {
                distrito = ubicacion.trim();
            }

            Lugar lugar = new Lugar(departamento, provincia, distrito, direccionRef);
            return lugarService.guardar(lugar);
        } catch (Exception ignored) {
            return null;
        }
    }
}

// controladores el rest y las vistas para manejar 
// las actividades, incluyendo la vista principal,