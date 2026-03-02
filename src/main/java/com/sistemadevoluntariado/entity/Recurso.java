package com.sistemadevoluntariado.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;

@Entity
@Table(name = "recurso")
public class Recurso {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_recurso")
    private int idRecurso;

    private String nombre;

    @Column(name = "unidad_medida")
    private String unidadMedida;

    @Column(name = "tipo_recurso")
    private String tipoRecurso;

    private String descripcion;

    @Column(name = "cantidad_total")
    private double cantidadTotal;

    // Campos transient calculados
    @Transient
    private double asignado;

    @Transient
    private double disponible;

    public Recurso() {}

    public Recurso(String nombre, String unidadMedida, String tipoRecurso, String descripcion) {
        this.nombre = nombre;
        this.unidadMedida = unidadMedida;
        this.tipoRecurso = tipoRecurso;
        this.descripcion = descripcion;
    }

    public int getIdRecurso() { return idRecurso; }
    public void setIdRecurso(int idRecurso) { this.idRecurso = idRecurso; }
    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }
    public String getUnidadMedida() { return unidadMedida; }
    public void setUnidadMedida(String unidadMedida) { this.unidadMedida = unidadMedida; }
    public String getTipoRecurso() { return tipoRecurso; }
    public void setTipoRecurso(String tipoRecurso) { this.tipoRecurso = tipoRecurso; }
    public String getDescripcion() { return descripcion; }
    public void setDescripcion(String descripcion) { this.descripcion = descripcion; }
    public double getCantidadTotal() { return cantidadTotal; }
    public void setCantidadTotal(double cantidadTotal) { this.cantidadTotal = cantidadTotal; }
    public double getAsignado() { return asignado; }
    public void setAsignado(double asignado) { this.asignado = asignado; }
    public double getDisponible() { return disponible; }
    public void setDisponible(double disponible) { this.disponible = disponible; }
}
