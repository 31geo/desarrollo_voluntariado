package com.sistemadevoluntariado.service;

import java.util.List;
import java.util.Map;
import java.util.logging.Level;
import java.util.logging.Logger;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sistemadevoluntariado.entity.MovimientoFinanciero;
import com.sistemadevoluntariado.entity.SalidaDonacion;
import com.sistemadevoluntariado.repository.SalidaDonacionRepository;
import com.sistemadevoluntariado.repository.TesoreriaRepositoryCustom;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

@Service
public class SalidaDonacionService {

    private static final Logger logger = Logger.getLogger(SalidaDonacionService.class.getName());

    @Autowired
    private SalidaDonacionRepository salidaDonacionRepository;

    @Autowired
    private TesoreriaRepositoryCustom tesoreriaRepository;

    @PersistenceContext
    private EntityManager em;

    @Transactional
    public List<SalidaDonacion> listarTodos() {
        return salidaDonacionRepository.listar();
    }

    @Transactional
    public SalidaDonacion obtenerPorId(int id) {
        return salidaDonacionRepository.obtenerPorId(id);
    }

    @Transactional
    public boolean guardar(SalidaDonacion s) {
        try {
            return salidaDonacionRepository.guardar(s);
        } catch (Exception e) {
            logger.log(Level.SEVERE, "Error al guardar salida de donacion", e);
            return false;
        }
    }

    @Transactional
    public boolean actualizar(SalidaDonacion s) {
        try {
            return salidaDonacionRepository.actualizar(s);
        } catch (Exception e) {
            logger.log(Level.SEVERE, "Error al actualizar salida de donacion", e);
            return false;
        }
    }

    @Transactional
    public boolean anular(int id, int idUsuario, String motivo) {
        try {
            // Obtener la salida antes de anular para eliminar el gasto en tesorería
            SalidaDonacion salida = salidaDonacionRepository.obtenerPorId(id);
            boolean ok = salidaDonacionRepository.anular(id, idUsuario, motivo);
            if (ok && salida != null && "CONFIRMADO".equalsIgnoreCase(salida.getEstado())) {
                eliminarGastoTesoreria(id);
            }
            return ok;
        } catch (Exception e) {
            logger.log(Level.SEVERE, "Error al anular salida de donacion", e);
            return false;
        }
    }

    /**
     * Cambia el estado de una salida. Retorna null si éxito, o un mensaje de error.
     */
    @Transactional
    public String cambiarEstado(int id, String estado) {
        try {
            // Validar saldo antes de confirmar una salida tipo DINERO
            if ("CONFIRMADO".equalsIgnoreCase(estado)) {
                SalidaDonacion salida = salidaDonacionRepository.obtenerPorId(id);
                if (salida != null && "DINERO".equalsIgnoreCase(salida.getTipoSalida())) {
                    Map<String, Double> balance = tesoreriaRepository.obtenerBalance();
                    double saldo = balance.getOrDefault("saldo", 0.0);
                    if (saldo < salida.getCantidad()) {
                        return "Saldo insuficiente en tesorería. Saldo actual: S/ "
                                + String.format("%.2f", saldo)
                                + ", monto de salida: S/ "
                                + String.format("%.2f", salida.getCantidad());
                    }
                }
            }

            boolean ok = salidaDonacionRepository.cambiarEstado(id, estado);
            if (!ok) return "No se pudo actualizar el estado";

            if ("CONFIRMADO".equalsIgnoreCase(estado)) {
                SalidaDonacion salida = salidaDonacionRepository.obtenerPorId(id);
                if (salida != null && "DINERO".equalsIgnoreCase(salida.getTipoSalida())) {
                    registrarGastoTesoreria(salida);
                }
            }
            return null; // éxito
        } catch (Exception e) {
            logger.log(Level.SEVERE, "Error al cambiar estado de salida", e);
            return "Error interno al cambiar estado";
        }
    }

    /**
     * Registra un GASTO en tesorería cuando se confirma una salida de donación tipo DINERO.
     */
    private void registrarGastoTesoreria(SalidaDonacion salida) {
        try {
            String descripcion = "Salida de Donación #" + salida.getIdSalida()
                    + " (Donación #" + salida.getIdDonacion() + ")"
                    + (salida.getDescripcion() != null && !salida.getDescripcion().isEmpty()
                    ? ": " + salida.getDescripcion() : "");

            // Verificar que no exista ya un movimiento para esta salida
            List<MovimientoFinanciero> existentes = tesoreriaRepository.filtrar(
                    "GASTO", "Salidas de Donaciones", null, null, "Salida de Donación #" + salida.getIdSalida());
            if (!existentes.isEmpty()) {
                logger.info("Ya existe movimiento en tesorería para salida #" + salida.getIdSalida());
                return;
            }

            em.createNativeQuery("CALL sp_registrarMovimiento(?1,?2,?3,?4,?5,?6,?7,?8)")
                    .setParameter(1, "GASTO")
                    .setParameter(2, salida.getCantidad())
                    .setParameter(3, descripcion)
                    .setParameter(4, "Salidas de Donaciones")
                    .setParameter(5, (String) null) // comprobante
                    .setParameter(6, java.time.LocalDate.now())
                    .setParameter(7, salida.getIdActividad())
                    .setParameter(8, salida.getIdUsuarioRegistro())
                    .getResultList();
            em.clear();
            logger.info("✓ Gasto registrado en tesorería para salida #" + salida.getIdSalida());
        } catch (Exception e) {
            logger.log(Level.WARNING, "Error al registrar gasto en tesorería para salida #" + salida.getIdSalida(), e);
        }
    }

    /**
     * Elimina el GASTO de tesorería cuando se anula una salida de donación.
     */
    private void eliminarGastoTesoreria(int idSalida) {
        try {
            List<MovimientoFinanciero> movimientos = tesoreriaRepository.filtrar(
                    "GASTO", "Salidas de Donaciones", null, null, "Salida de Donación #" + idSalida);
            for (MovimientoFinanciero mv : movimientos) {
                em.createNativeQuery("DELETE FROM movimiento_financiero WHERE id_movimiento = ?1")
                        .setParameter(1, mv.getIdMovimiento())
                        .executeUpdate();
                logger.info("✓ Gasto eliminado de tesorería (mov #" + mv.getIdMovimiento() + ") por anulación de salida #" + idSalida);
            }
            em.clear();
        } catch (Exception e) {
            logger.log(Level.WARNING, "Error al eliminar gasto de tesorería para salida #" + idSalida, e);
        }
    }

    @Transactional
    public List<Map<String, Object>> listarDonacionesDisponibles() {
        return salidaDonacionRepository.listarDonacionesDisponibles();
    }

    @Transactional(readOnly = true, noRollbackFor = Exception.class)
    public List<Map<String, Object>> buscarDonacionesDisponibles(String query) {
        return salidaDonacionRepository.buscarDonacionesDisponibles(query);
    }

    @Transactional(readOnly = true, noRollbackFor = Exception.class)
    public Map<String, Object> obtenerSaldoDisponible(int idDonacion) {
        return salidaDonacionRepository.obtenerSaldoDisponible(idDonacion);
    }
}
