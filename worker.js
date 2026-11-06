/**
 * CLOUDFLARE WORKER: oscarfit-ai-agent (OscarFit 714)
 * Servidor Backend Seguro con permisos de service_role.
 * Sincronizado estrictamente con Supabase (tfovculjswtxwonmxjnq)
 * 
 * Contratos soportados:
 * 1. POST /api/orders ó /orders -> public.create_order(p_plan_code, p_customer_name, p_customer_email, p_customer_phone, p_transfer_ref, p_payment_method)
 * 2. GET /api/orders ó /orders -> select * from orders
 * 3. POST /api/verify-order ó /verify-order -> public.verify_order_payment(p_order_id, p_approve, p_note)
 * 4. GET /api/plans ó /plans -> select * from plans where active = true
 * 5. POST /api/chat ó /chat -> Asesoría IA Multi-Negocio
 * 6. POST /api/webhook -> Webhooks autenticados
 * 7. /api/leads y /api/content-drafts -> CRM y Contenidos
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '*';

    // Headers estándar de CORS
    const corsHeaders = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Webhook-Secret, apikey',
      'Access-Control-Max-Age': '86400',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const SUPABASE_URL = env.SUPABASE_URL || 'https://tfovculjswtxwonmxjnq.supabase.co';
    const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY || '';
    const WEBHOOK_SECRET = env.OSCARFIT_WEBHOOK_SECRET || 'of_sec_714_live_auth';

    // Helper para registrar eventos en automation_logs
    async function logAutomationEvent(eventType, payload, status = 'success', errorMsg = null) {
      if (!SUPABASE_SERVICE_ROLE_KEY) return;
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/automation_logs`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            event_type: eventType,
            payload,
            status,
            error: errorMsg,
            created_at: new Date().toISOString()
          })
        });
      } catch (e) {
        console.error('Error logging to automation_logs:', e);
      }
    }

    // =========================================================================
    // 1. CREACIÓN Y CONSULTA DE ÓRDENES (/api/orders | /orders)
    // =========================================================================
    if (url.pathname === '/api/orders' || url.pathname === '/orders') {
      // POST: Creación de orden pública vía RPC create_order (Service Role)
      if (request.method === 'POST') {
        let body = {};
        try {
          body = await request.json();
        } catch (e) {
          return new Response(JSON.stringify({ ok: false, error: 'JSON de solicitud inválido' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const planCode = body.p_plan_code || body.plan_code || body.plan_slug || body.product_id || body.product_code || body.code || body.slug;
        const customerName = body.p_customer_name || body.customer_name || body.name || body.customer?.name;
        const customerEmail = body.p_customer_email || body.customer_email || body.email || body.customer?.email;
        const customerPhone = body.p_customer_phone || body.customer_phone || body.phone || body.customer?.phone || null;
        const transferRef = body.p_transfer_ref || body.transfer_ref || body.transfer_receipt_ref || body.receipt_ref || body.receiptRef || null;
        const paymentMethod = body.p_payment_method || body.payment_method || 'transferencia';

        if (!planCode || !customerName || !customerEmail) {
          return new Response(JSON.stringify({ 
            ok: false, 
            error: 'Campos obligatorios faltantes: plan_code, customer_name, customer_email son requeridos' 
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (!SUPABASE_SERVICE_ROLE_KEY) {
          return new Response(JSON.stringify({
            ok: false,
            error: 'SUPABASE_SERVICE_ROLE_KEY no configurado en el Worker'
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        try {
          const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/create_order`, {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_SERVICE_ROLE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              p_plan_code: planCode,
              p_customer_name: customerName.trim(),
              p_customer_email: customerEmail.trim().toLowerCase(),
              p_customer_phone: customerPhone ? customerPhone.trim() : null,
              p_transfer_ref: transferRef ? transferRef.trim() : null,
              p_payment_method: paymentMethod
            })
          });

          const rpcData = await rpcRes.json().catch(() => null);

          if (!rpcRes.ok) {
            const errorMsg = rpcData?.message || rpcData?.details || rpcData?.hint || 'Error ejecutando create_order en Supabase';
            await logAutomationEvent('order_create_failed', { planCode, customerEmail, error: errorMsg }, 'error', errorMsg);
            return new Response(JSON.stringify({ ok: false, error: errorMsg, details: rpcData }), {
              status: rpcRes.status,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Respuesta exitosa formateada
          const result = {
            ok: true,
            order_id: rpcData?.order_id || rpcData?.id,
            order_code: rpcData?.order_code || rpcData?.code,
            status: rpcData?.status || 'pending',
            amount: rpcData?.amount,
            currency: rpcData?.currency || 'USD',
            plan_code: rpcData?.plan_code || planCode,
            plan_slug: rpcData?.plan_slug,
            data: rpcData
          };

          await logAutomationEvent('order_created', { 
            order_id: result.order_id, 
            order_code: result.order_code, 
            planCode, 
            customerEmail 
          }, 'success');

          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (err) {
          await logAutomationEvent('order_create_exception', { planCode, customerEmail, error: err.message }, 'error', err.message);
          return new Response(JSON.stringify({ ok: false, error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // GET: Listar órdenes de la tabla orders
      if (request.method === 'GET') {
        const limit = url.searchParams.get('limit') || '100';
        const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?select=*&order=created_at.desc&limit=${limit}`, {
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
          }
        });
        const data = await res.json().catch(() => []);
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // =========================================================================
    // 2. VERIFICACIÓN Y APROBACIÓN DE PAGO (/api/verify-order | /verify-order)
    // =========================================================================
    if ((url.pathname === '/api/verify-order' || url.pathname === '/verify-order') && request.method === 'POST') {
      let body = {};
      try {
        body = await request.json();
      } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: 'JSON inválido' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const orderId = body.p_order_id || body.orderId || body.order_id;
      const approve = body.p_approve !== undefined ? Boolean(body.p_approve) : (body.approve !== undefined ? Boolean(body.approve) : true);
      const note = body.p_note || body.note || body.transferReceiptRef || body.transfer_receipt_ref || null;

      if (!orderId) {
        return new Response(JSON.stringify({ ok: false, error: 'p_order_id / orderId es obligatorio' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      try {
        const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/verify_order_payment`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            p_order_id: orderId,
            p_approve: approve,
            p_note: note ? note.trim() : null
          })
        });

        const rpcData = await rpcRes.json().catch(() => null);

        if (!rpcRes.ok) {
          const errorMsg = rpcData?.message || rpcData?.details || 'Error en verify_order_payment';
          await logAutomationEvent('verify_payment_failed', { orderId, approve, error: errorMsg }, 'error', errorMsg);
          return new Response(JSON.stringify({ ok: false, error: errorMsg, details: rpcData }), {
            status: rpcRes.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        await logAutomationEvent('verify_payment_success', { orderId, approve, note, rpcData }, 'success');

        return new Response(JSON.stringify({
          ok: true,
          success: true,
          order_id: orderId,
          approved: approve,
          order_code: rpcData?.order_code,
          status: rpcData?.status || (approve ? 'paid' : 'rejected'),
          license_key: rpcData?.license_key,
          data: rpcData
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ ok: false, error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // =========================================================================
    // 3. CONSULTA DE CATÁLOGO / PLANES ACTIVOS (/api/plans | /plans)
    // =========================================================================
    if (url.pathname === '/api/plans' || url.pathname === '/plans') {
      const brand = url.searchParams.get('brand');
      let query = `${SUPABASE_URL}/rest/v1/plans?select=*&active=eq.true&order=price.asc`;
      if (brand && brand !== 'all') {
        query += `&brand=eq.${brand}`;
      }
      const res = await fetch(query, {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
      });
      const data = await res.json().catch(() => []);
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // =========================================================================
    // 4. ASESORÍA IA CONTEXTUAL MULTI-NEGOCIO (/api/chat | /chat)
    // =========================================================================
    if ((url.pathname === '/api/chat' || url.pathname === '/chat') && request.method === 'POST') {
      let body = {};
      try {
        body = await request.json();
      } catch (e) {}

      const userMessage = body.message || body.prompt || '';
      const context = body.context || {};
      const brand = (context.brand || body.brand || 'oscarfit').toLowerCase();

      // Si hay GEMINI_API_KEY configurada, podemos invocar Gemini
      const GEMINI_API_KEY = env.GEMINI_API_KEY || '';
      if (GEMINI_API_KEY && userMessage) {
        try {
          let systemInstruction = "Eres la Asesora IA de OscarFit.";
          if (brand === 'oscar_choice') {
            systemInstruction = "Eres Sofía, Asesora de Óscar Choice Calzado de Confort en Guayaquil. Recomiendas calzado anatómico y confort con perlas. Si preguntan por tallas, asesora sobre tallas 35 a 40 con plantilla memory foam.";
          } else if (brand === 'intercam') {
            systemInstruction = "Eres el Ingeniero de Soporte de Intercam CCTV y Seguridad Electrónica. Asesoras sobre cámaras WiFi 6, domos PTZ, DVRs y kits de videovigilancia para casas y negocios en Ecuador.";
          } else {
            systemInstruction = "Eres la Asesora Oficial de OscarFit y del Coach Oscarfit Coronado. Guías sobre la App oscar1 ($19/mes o $47 único), asesoría 1 a 1 y guías nutricionales en gramos.";
          }

          const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemInstruction }] },
              contents: [{ role: 'user', parts: [{ text: userMessage }] }]
            })
          });

          const geminiData = await geminiRes.json();
          const reply = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (reply) {
            return new Response(JSON.stringify({ ok: true, reply, brand }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        } catch (geminiErr) {
          console.warn('Gemini error:', geminiErr);
        }
      }

      // Respuesta contextual de respaldo
      let defaultReply = "¡Hola! Con gusto te asesoro. ¿Tienes alguna duda sobre la App Móvil de OscarFit o las asesorías personalizadas?";
      if (brand === 'oscar_choice') {
        defaultReply = "¡Hola! Bienvenida a Óscar Choice. Te ayudo a elegir la sandalia de confort ideal. Nuestras hormas son estándar (35 al 40) con plantilla acojinada.";
      } else if (brand === 'intercam') {
        defaultReply = "¡Saludos de Intercam Seguridad! Te cotizamos sistemas de cámaras IP y CCTV para tu hogar o empresa con instalación y monitoreo móvil.";
      }

      return new Response(JSON.stringify({ ok: true, reply: defaultReply, brand }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // =========================================================================
    // 5. ENDPOINT WEBHOOK CON SECRET (OSCARFIT_WEBHOOK_SECRET)
    // =========================================================================
    if (url.pathname === '/api/webhook' || url.pathname === '/webhook') {
      const incomingSecret = request.headers.get('X-Webhook-Secret') || url.searchParams.get('secret');
      if (incomingSecret !== WEBHOOK_SECRET) {
        await logAutomationEvent('webhook_unauthorized', { ip: request.headers.get('CF-Connecting-IP') }, 'error', 'Invalid secret');
        return new Response(JSON.stringify({ error: 'Unauthorized: Missing or invalid OSCARFIT_WEBHOOK_SECRET' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      let payload = {};
      try {
        payload = await request.json();
      } catch (e) {}

      await logAutomationEvent('webhook_received', payload, 'success');
      return new Response(JSON.stringify({ ok: true, status: 'processed' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // =========================================================================
    // 6. ENDPOINT LEADS (/api/leads)
    // =========================================================================
    if (url.pathname === '/api/leads' || url.pathname === '/leads') {
      if (request.method === 'GET') {
        const brand = url.searchParams.get('brand');
        let query = `${SUPABASE_URL}/rest/v1/leads?select=*&order=created_at.desc`;
        if (brand && brand !== 'all') {
          query += `&brand=eq.${brand}`;
        }
        const res = await fetch(query, {
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
          }
        });
        const data = await res.json().catch(() => []);
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (request.method === 'POST') {
        const body = await request.json();
        const res = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(body)
        });
        const data = await res.json().catch(() => body);
        await logAutomationEvent('lead_created', { lead: body }, 'success');
        return new Response(JSON.stringify({ success: true, lead: Array.isArray(data) ? data[0] : data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // =========================================================================
    // 7. CONTENT DRAFTS (/api/content-drafts)
    // =========================================================================
    if (url.pathname === '/api/content-drafts' || url.pathname === '/content-drafts') {
      if (request.method === 'GET') {
        const kind = url.searchParams.get('kind');
        let query = `${SUPABASE_URL}/rest/v1/content_drafts?select=*&order=created_at.desc`;
        if (kind) query += `&kind=eq.${kind}`;
        const res = await fetch(query, {
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
          }
        });
        const data = await res.json().catch(() => []);
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (request.method === 'POST') {
        const draft = await request.json();
        const res = await fetch(`${SUPABASE_URL}/rest/v1/content_drafts`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(draft)
        });
        const data = await res.json().catch(() => draft);
        return new Response(JSON.stringify({ success: true, draft: Array.isArray(data) ? data[0] : data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Default 404
    return new Response(JSON.stringify({ error: 'Endpoint not found', path: url.pathname }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};
