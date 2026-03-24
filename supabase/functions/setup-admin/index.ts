import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Create admin user
    const { data, error } = await supabase.auth.admin.createUser({
      email: 'admin@commentiq.com',
      password: 'admin123456',
      email_confirm: true,
      user_metadata: { full_name: 'Administrador' }
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Add admin role
    await supabase.from('user_roles').insert({ user_id: data.user.id, role: 'admin' });
    
    // Update plan
    await supabase.from('profiles').update({ plan: 'enterprise' }).eq('user_id', data.user.id);

    return new Response(JSON.stringify({ success: true, user_id: data.user.id, email: 'admin@commentiq.com', password: 'admin123456' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
