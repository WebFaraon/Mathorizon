import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webPush from 'npm:web-push';

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC_KEY     = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY    = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT        = 'mailto:bivoldragos6@gmail.com';

webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { class_id, type, teacher_name } = await req.json();

    const messages: Record<string, { title: string; body: string }> = {
      announcement: {
        title: 'Anunț nou în clasă 📢',
        body:  `${teacher_name} a publicat un anunț nou!`,
      },
      assignment: {
        title: 'Temă nouă primită 📚',
        body:  `${teacher_name} a adăugat o temă nouă!`,
      },
    };
    const msg = messages[type] ?? messages.announcement;
    const payload = JSON.stringify({ ...msg, url: `/class.html?id=${class_id}` });

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: subs, error } = await sb
      .from('push_subscriptions')
      .select('subscription')
      .eq('class_id', class_id);

    if (error) throw error;
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results = await Promise.allSettled(
      subs.map((row: { subscription: PushSubscriptionJSON }) =>
        webPush.sendNotification(row.subscription as webPush.PushSubscription, payload)
      )
    );

    const sent   = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.length - sent;

    return new Response(JSON.stringify({ sent, failed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[send-class-push]', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
