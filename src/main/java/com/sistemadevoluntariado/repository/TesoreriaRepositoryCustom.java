package com.sistemadevoluntariado.repository;

import java.util.List;
import java.util.Map;

import com.sistemadevoluntariado.entity.MovimientoFinanciero;

public interface TesoreriaRepositoryCustom {

    List<MovimientoFinanciero> listarConJoins();

    Map<String, Double> obtenerBalance();

    List<MovimientoFinanciero> filtrar(String tipo, String categoria, String fechaInicio, String fechaFin, String busqueda);

    List<Map<String, Object>> resumenPorCategoria();

    List<Map<String, Object>> resumenMensual();

    List<Map<String, Object>> donacionesPorCampana();

    List<Map<String, Object>> donacionesDisponibles();

    Map<String, Object> obtenerSaldoDonacion(int idDonacion);

    void registrarGastoDonacion(int idMovimiento, int idDonacion, double monto);

    void eliminarGastoDonacion(int idMovimiento);
}
