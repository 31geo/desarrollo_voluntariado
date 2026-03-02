package com.sistemadevoluntariado.service;

import java.util.List;
import java.util.Map;
import java.util.logging.Level;
import java.util.logging.Logger;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.sistemadevoluntariado.entity.MovimientoFinanciero;
import com.sistemadevoluntariado.repository.TesoreriaRepository;

@Service
public class TesoreriaService {

    private static final Logger logger = Logger.getLogger(TesoreriaService.class.getName());

    @Autowired
    private TesoreriaRepository tesoreriaRepository;

    @Transactional
    public List<MovimientoFinanciero> listar() {
        return tesoreriaRepository.listarConJoins();
    }

    @Transactional
    public MovimientoFinanciero obtenerPorId(int id) {
        return tesoreriaRepository.findById(id).orElse(null);
    }

    @Transactional
    public Map<String, Double> obtenerBalance() {
        return tesoreriaRepository.obtenerBalance();
    }

    @Transactional
    public List<MovimientoFinanciero> filtrar(String tipo, String categoria, String fechaInicio, String fechaFin, String busqueda) {
        return tesoreriaRepository.filtrar(tipo, categoria, fechaInicio, fechaFin, busqueda);
    }

    @Transactional
    public List<Map<String, Object>> resumenPorCategoria() {
        return tesoreriaRepository.resumenPorCategoria();
    }

    @Transactional
    public List<Map<String, Object>> resumenMensual() {
        return tesoreriaRepository.resumenMensual();
    }

    @Transactional
    public List<Map<String, Object>> donacionesPorCampana() {
        return tesoreriaRepository.donacionesPorCampana();
    }

    @Transactional
    public boolean registrar(MovimientoFinanciero m) {
        try {
            tesoreriaRepository.save(m);
            tesoreriaRepository.flush();
            logger.info("✓ Movimiento registrado ID: " + m.getIdMovimiento());
            return true;
        } catch (Exception e) {
            logger.log(Level.SEVERE, "Error al registrar movimiento en tesorería", e);
            return false;
        }
    }

    @Transactional
    public boolean actualizar(MovimientoFinanciero m) {
        try {
            tesoreriaRepository.save(m);
            tesoreriaRepository.flush();
            return true;
        } catch (Exception e) {
            logger.log(Level.SEVERE, "Error al actualizar movimiento en tesorería", e);
            return false;
        }
    }

    @Transactional
    public boolean eliminar(int id) {
        try {
            tesoreriaRepository.eliminarGastoDonacion(id);
            tesoreriaRepository.deleteById(id);
            return true;
        } catch (Exception e) {
            logger.log(Level.SEVERE, "Error al eliminar movimiento en tesorería", e);
            return false;
        }
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> donacionesDisponibles() {
        return tesoreriaRepository.donacionesDisponibles();
    }

    @Transactional(readOnly = true)
    public Map<String, Object> obtenerSaldoDonacion(int idDonacion) {
        return tesoreriaRepository.obtenerSaldoDonacion(idDonacion);
    }

    @Transactional
    public Map<String, Object> registrarGastoConDonacion(MovimientoFinanciero m, int idDonacion) {
        Map<String, Object> resp = new java.util.HashMap<>();
        try {
            // Validar saldo de la donación
            Map<String, Object> saldoInfo = tesoreriaRepository.obtenerSaldoDonacion(idDonacion);
            double saldoDisp = saldoInfo.containsKey("saldoDisponible")
                    ? ((Number) saldoInfo.get("saldoDisponible")).doubleValue() : 0.0;

            if (m.getMonto() > saldoDisp) {
                resp.put("success", false);
                resp.put("message", "El monto (S/ " + String.format("%.2f", m.getMonto())
                        + ") excede el saldo disponible de la donación (S/ "
                        + String.format("%.2f", saldoDisp) + ")");
                return resp;
            }

            // Registrar el movimiento
            tesoreriaRepository.save(m);
            tesoreriaRepository.flush();

            // Registrar la relación gasto_donacion
            tesoreriaRepository.registrarGastoDonacion(m.getIdMovimiento(), idDonacion, m.getMonto());

            resp.put("success", true);
            resp.put("message", "Gasto registrado correctamente");
            return resp;
        } catch (Exception e) {
            logger.log(Level.SEVERE, "Error al registrar gasto con donación", e);
            resp.put("success", false);
            resp.put("message", "Error: " + e.getMessage());
            return resp;
        }
    }
}
