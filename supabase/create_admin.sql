-- =====================================================================
-- PROMOVER EL PRIMER ADMINISTRADOR
-- 1) Cree el usuario en Authentication > Users > Add user (marque "Auto Confirm User").
-- 2) Reemplace el correo y ejecute:
-- =====================================================================
update public.profiles
   set role = 'administrador', active = true,
       first_name = 'Administrador', last_name = 'General'
 where email = 'admin@ejemplo.com';

select id, email, role, active from public.profiles;
