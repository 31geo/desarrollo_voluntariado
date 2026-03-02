package com.sistemadevoluntariado.repository;

import java.util.ArrayList;
import java.util.List;
import java.util.logging.Level;
import java.util.logging.Logger;

import com.sistemadevoluntariado.entity.Notificacion;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

public class NotificacionRepositoryImpl implements NotificacionRepositoryCustom {

    private static final Logger logger = Logger.getLogger(NotificacionRepositoryImpl.class.getName());

    @PersistenceContext
    private EntityManager em;

    @Override
    @SuppressWarnings("unchecked")
    public List<Notificacion> listarPorUsuario(int idUsuario) {
        try {
            List<Object[]> rows = em.createNativeQuery(
                "SELECT id_notificacion, id_usuario, tipo, titulo, mensaje, icono, color, " +
                "leida, referencia_id, fecha_creacion " +
                "FROM notificaciones " +
                "WHERE id_usuario = :uid " +
                "ORDER BY fecha_creacion DESC LIMIT 30")
                .setParameter("uid", idUsuario)
                .getResultList();
            List<Notificacion> lista = new ArrayList<>();
            for (Object[] row : rows) {
                Notificacion n = new Notificacion();
                n.setIdNotificacion(((Number) row[0]).intValue());
                n.setIdUsuario(((Number) row[1]).intValue());
                n.setTipo((String) row[2]);
                n.setTitulo((String) row[3]);
                n.setMensaje((String) row[4]);
                n.setIcono(row[5] != null ? (String) row[5] : "fa-bell");
                n.setColor(row[6] != null ? (String) row[6] : "#6366f1");
                n.setLeida(row[7] != null && (row[7] instanceof Boolean ? (Boolean) row[7] : ((Number) row[7]).intValue() == 1));
                n.setReferenciaId(row[8] != null ? ((Number) row[8]).intValue() : 0);
                n.setFechaCreacion(row[9] != null ? row[9].toString() : null);
                lista.add(n);
            }
            return lista;
        } catch (Exception e) {
            logger.log(Level.SEVERE, "Error al listar notificaciones", e);
            return new ArrayList<>();
        }
    }

    @Override
    public int contarNoLeidas(int idUsuario) {
        try {
            Object result = em.createNativeQuery(
                "SELECT COUNT(*) FROM notificaciones WHERE id_usuario = :uid AND leida = 0")
                .setParameter("uid", idUsuario)
                .getSingleResult();
            return result != null ? ((Number) result).intValue() : 0;
        } catch (Exception e) {
            logger.log(Level.SEVERE, "Error al contar notificaciones no leidas", e);
            return 0;
        }
    }

    @Override
    public void marcarLeida(int idNotificacion) {
        try {
            em.createNativeQuery("DELETE FROM notificaciones WHERE id_notificacion = :id")
                .setParameter("id", idNotificacion)
                .executeUpdate();
        } catch (Exception e) {
            logger.log(Level.WARNING, "Error al eliminar notificacion", e);
        }
    }

    @Override
    public void marcarTodasLeidas(int idUsuario) {
        try {
            em.createNativeQuery("DELETE FROM notificaciones WHERE id_usuario = :uid")
                .setParameter("uid", idUsuario)
                .executeUpdate();
        } catch (Exception e) {
            logger.log(Level.WARNING, "Error al eliminar todas las notificaciones", e);
        }
    }

    @Override
    public void generarNotificacionesActividadesHoy(int idUsuario) {
        try {
            em.createNativeQuery(
                "INSERT INTO notificaciones (id_usuario, tipo, titulo, mensaje, icono, color, referencia_id) " +
                "SELECT :uid, 'ACTIVIDAD_HOY', " +
                "CONCAT('Actividad hoy: ', a.nombre), " +
                "CONCAT('La actividad \"', a.nombre, '\" esta programada para hoy en ', IFNULL(a.ubicacion, 'ubicacion por definir'), '.'), " +
                "'fa-calendar-check', '#10b981', a.id_actividad " +
                "FROM actividades a " +
                "WHERE DATE(a.fecha_inicio) = CURDATE() AND a.estado = 'ACTIVO' " +
                "AND NOT EXISTS (" +
                "  SELECT 1 FROM notificaciones n " +
                "  WHERE n.id_usuario = :uid AND n.tipo = 'ACTIVIDAD_HOY' " +
                "  AND n.referencia_id = a.id_actividad AND DATE(n.fecha_creacion) = CURDATE())")
                .setParameter("uid", idUsuario)
                .executeUpdate();
        } catch (Exception e) {
            logger.log(Level.WARNING, "Error al generar notificaciones de actividades: " + e.getMessage());
        }
    }

    @Override
    public void generarNotificacionesEventosHoy(int idUsuario) {
        try {
            em.createNativeQuery(
                "INSERT INTO notificaciones (id_usuario, titulo, mensaje, tipo, leida, fecha_creacion) " +
                "SELECT :uid, " +
                "CONCAT('Evento hoy: ', e.titulo), " +
                "CONCAT('Tienes programado \"', e.titulo, '\" para hoy'), " +
                "'EVENTO', 0, NOW() " +
                "FROM eventos_calendario e " +
                "WHERE DATE(e.fecha_inicio) = CURDATE() AND e.id_usuario = :uid " +
                "AND NOT EXISTS (" +
                "  SELECT 1 FROM notificaciones n " +
                "  WHERE n.id_usuario = :uid AND n.tipo = 'EVENTO' " +
                "  AND n.titulo = CONCAT('Evento hoy: ', e.titulo) " +
                "  AND DATE(n.fecha_creacion) = CURDATE())")
                .setParameter("uid", idUsuario)
                .executeUpdate();
        } catch (Exception e) {
            logger.log(Level.WARNING, "Error al generar notificaciones de eventos: " + e.getMessage());
        }
    }

    @Override
    public void eliminarNotificacion(int idNotificacion) {
        try {
            em.createNativeQuery("DELETE FROM notificaciones WHERE id_notificacion = :id")
                .setParameter("id", idNotificacion)
                .executeUpdate();
        } catch (Exception e) {
            logger.log(Level.WARNING, "Error al eliminar notificacion: " + e.getMessage());
        }
    }

    @Override
    public void eliminarTodasNotificaciones(int idUsuario) {
        try {
            em.createNativeQuery("DELETE FROM notificaciones WHERE id_usuario = :uid")
                .setParameter("uid", idUsuario)
                .executeUpdate();
        } catch (Exception e) {
            logger.log(Level.WARNING, "Error al eliminar todas las notificaciones: " + e.getMessage());
        }
    }

    @Override
    public void generarNotifDiaLleno(int idUsuario, String fecha) {
        try {
            em.createNativeQuery(
                "INSERT INTO notificaciones (id_usuario, tipo, titulo, mensaje, icono, color, referencia_id) " +
                "SELECT :uid, 'DIA_LLENO', " +
                "CONCAT('Agenda llena: ', DATE_FORMAT(:fecha, '%d/%m/%Y')), " +
                "CONCAT('Tienes ', COUNT(*), ' eventos agendados para el ', DATE_FORMAT(:fecha, '%d/%m/%Y'), '. El dia esta completo.'), " +
                "'fa-calendar-days', '#f59e0b', DATEDIFF(:fecha, '2000-01-01') " +
                "FROM eventos_calendario " +
                "WHERE id_usuario = :uid AND DATE(fecha_inicio) = :fecha " +
                "HAVING COUNT(*) >= 3 " +
                "AND NOT EXISTS (" +
                "  SELECT 1 FROM notificaciones n " +
                "  WHERE n.id_usuario = :uid AND n.tipo = 'DIA_LLENO' " +
                "  AND DATE(n.fecha_creacion) = CURDATE() " +
                "  AND n.referencia_id = DATEDIFF(:fecha, '2000-01-01'))")
                .setParameter("uid", idUsuario)
                .setParameter("fecha", fecha)
                .executeUpdate();
        } catch (Exception e) {
            logger.log(Level.WARNING, "Error al generar notif dia lleno: " + e.getMessage());
        }
    }
}
