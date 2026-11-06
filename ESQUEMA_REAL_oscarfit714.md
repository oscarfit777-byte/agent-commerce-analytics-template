# Esquema REAL de Supabase oscarfit714
Proyecto: eomrfsfwiblnsilezxda · URL: https://eomrfsfwiblnsilezxda.supabase.co

## Reglas obligatorias
1. No inventes tablas ni columnas. No ejecutes ni generes SQL contra la base.
2. Roles válidos: COACH, CLIENT, ADMIN (en mayúsculas). Todo registro nuevo nace como CLIENT. El rol se lee de profiles.role con la sesión del usuario.
3. leads, lead_events, orders y automation_logs son solo del servidor (backend/worker con service_role). La app móvil NO las lee ni las escribe.
4. El acceso de pago se decide con get_my_membership(), nunca leyendo app_licenses ni membership_status.
5. Un pedido nuevo nace en orders con status = 'pendiente_pago' hasta que Oscar verifica el comprobante (transfer_receipt_ref) -> 'pago_verificado' -> activate_membership_from_order(p_order_id).
6. Los precios salen siempre de la tabla plans.
7. La marca blanca de cada entrenador vive en coach_branding (reemplaza a workspaces).
8. Todo contenido de marketing, objeciones, guiones de voz o B2B se guarda en content_drafts (kind: campana_redes|respuesta_objecion|guion_voz|prospeccion_b2b|otro, channel: tiktok|instagram|facebook|meta_ads|whatsapp|llamada|email|linkedin|otro, brand: oscarfit|oscar_choice|intercam). Todo nace como 'borrador' y solo el dueño (Oscar con su sesión de usuario) puede pasar a 'aprobado' si checks.prices_ok no es false y plan_codes existen en plans.
9. Datos de salud en profiles (age, height_cm, weight_kg, fitness_goal, health_consent_at) solo se guardan con la RPC save_my_health_data(p_age, p_height_cm, p_weight_kg, p_fitness_goal, p_consent) tras marcar casilla de consentimiento, y se borran con delete_my_health_data().
10. Tablas que NO existen (prohibido usarlas): user_accounts, app_licenses, workspaces, students, coaches, routine_days, meal_plans, invitations.
