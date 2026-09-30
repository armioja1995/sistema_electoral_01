-- =====================================================================
-- DATOS DEMO (opcional). También puede crearlos desde la app:
-- Configuración electoral > "Crear datos demo".
-- Ejecutado desde el SQL Editor, las mesas quedan sin registrador asignado.
-- =====================================================================
select public.seed_demo_data(true);

-- Para eliminarlos:
-- select public.delete_demo_data();
