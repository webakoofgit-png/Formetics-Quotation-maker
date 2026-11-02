-- Formatix workspace: all writes go through atomic, authorized RPCs.
create table public.formatix_workspaces (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 state jsonb not null, revision integer not null default 0, created_at timestamptz not null default now()
);
create table public.formatix_members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 workspace_id uuid not null references public.formatix_workspaces(id) on delete cascade,
 name text not null, email text not null, role text not null check(role in ('Admin','Staff'))
);
create table public.formatix_customers (
 workspace_id uuid not null references public.formatix_workspaces(id) on delete cascade,
 phone text not null check(phone ~ '^[0-9]{10}$'), name text not null, lead_source text, notes text,
 primary key(workspace_id, phone)
);
create table public.formatix_vehicles (
 workspace_id uuid not null, id text not null, customer_phone text not null,
 model text, category text, vehicle_type text, colour text, registration text,
 primary key(workspace_id,id), foreign key(workspace_id,customer_phone) references public.formatix_customers(workspace_id,phone)
);
create table public.formatix_services (
 workspace_id uuid not null references public.formatix_workspaces(id) on delete cascade,
 id text not null, name text not null, category text not null, description text, active boolean not null, position integer not null,
 primary key(workspace_id,id)
);
create table public.formatix_vehicle_prices (
 workspace_id uuid not null, service_id text not null, category text not null, price_paise bigint not null check(price_paise>=0),
 primary key(workspace_id,service_id,category), foreign key(workspace_id,service_id) references public.formatix_services(workspace_id,id) on delete cascade
);
create table public.formatix_quotations (
 workspace_id uuid not null references public.formatix_workspaces(id) on delete cascade,
 id uuid not null, number text not null, customer_phone text not null, vehicle_id text not null,
 date date not null, staff text not null, status text not null check(status in ('Draft','Sent','Booked','Lost')),
 subtotal_paise bigint not null check(subtotal_paise>=0), discount_paise bigint not null check(discount_paise>=0 and discount_paise<=subtotal_paise),
 total_paise bigint generated always as(subtotal_paise-discount_paise) stored,
 taxable_paise bigint not null, gst_paise bigint not null, booking_paise bigint not null check(booking_paise>=0 and booking_paise<=subtotal_paise-discount_paise),
 snapshot jsonb not null,
 primary key(workspace_id,id), unique(workspace_id,number),
 foreign key(workspace_id,customer_phone) references public.formatix_customers(workspace_id,phone),
 foreign key(workspace_id,vehicle_id) references public.formatix_vehicles(workspace_id,id),
 check(taxable_paise+gst_paise=subtotal_paise-discount_paise)
);
create table public.formatix_quotation_items (
 workspace_id uuid not null, quotation_id uuid not null, id uuid not null, service_id text, name text not null, price_paise bigint not null check(price_paise>=0),
 primary key(workspace_id,quotation_id,id), foreign key(workspace_id,quotation_id) references public.formatix_quotations(workspace_id,id) on delete cascade
);
create table public.formatix_followups (
 workspace_id uuid not null, id uuid not null, quotation_id uuid not null, followup_date date not null,
 employee text not null, priority text not null check(priority in ('Low','Normal','High')), notes text, done boolean not null default false,
 primary key(workspace_id,id), foreign key(workspace_id,quotation_id) references public.formatix_quotations(workspace_id,id) on delete cascade
);
create table public.formatix_settings (workspace_id uuid primary key references public.formatix_workspaces(id) on delete cascade, details jsonb not null, tax_rate numeric not null default 18 check(tax_rate=18));
create table public.formatix_audit_logs (id bigint generated always as identity primary key, workspace_id uuid not null references public.formatix_workspaces(id), actor uuid not null references auth.users(id), action text not null, revision integer not null, at timestamptz not null default now());

create function public.formatix_workspace() returns uuid language sql stable security definer set search_path=public as $$ select workspace_id from public.formatix_members where user_id=auth.uid() $$;
revoke all on function public.formatix_workspace() from public;
grant execute on function public.formatix_workspace() to authenticated;
do $$ declare t text; begin
 foreach t in array array['workspaces','members','customers','vehicles','services','vehicle_prices','quotations','quotation_items','followups','settings','audit_logs'] loop
 execute format('alter table public.formatix_%I enable row level security',t);
 if t='workspaces' then
 execute 'create policy workspace_read on public.formatix_workspaces for select to authenticated using(id=public.formatix_workspace())';
 else
 execute format('create policy member_read on public.formatix_%I for select to authenticated using(workspace_id=public.formatix_workspace())',t);
 end if;
 execute format('revoke all on public.formatix_%I from anon,authenticated',t);
 execute format('grant select on public.formatix_%I to authenticated',t);
 end loop;
end $$;

create function public.formatix_load() returns jsonb language plpgsql security definer set search_path=public as $$
declare m public.formatix_members; w public.formatix_workspaces;
begin
 select * into m from public.formatix_members where user_id=auth.uid();
 if not found then raise exception 'No workspace yet. Create one, or ask your studio Admin to add your registered email.'; end if;
 select * into w from public.formatix_workspaces where id=m.workspace_id;
 return jsonb_build_object('state',w.state,'revision',w.revision,'workspace',w.id,'role',m.role,'members',(select coalesce(jsonb_agg(jsonb_build_object('id',user_id,'name',name,'email',email,'role',role)),'[]'::jsonb) from public.formatix_members where workspace_id=w.id));
end $$;

create function public.formatix_save(next_state jsonb,expected_revision integer) returns integer language plpgsql security definer set search_path=public as $$
declare m public.formatix_members; w public.formatix_workspaces; q jsonb; i jsonb; s jsonb; f jsonb; old_q jsonb; old_i jsonb; price record; subtotal bigint; disc bigint; booking bigint; taxable bigint; vehicle_key text; position integer:=0;
begin
 select * into m from public.formatix_members where user_id=auth.uid();
 if not found then raise exception 'Authentication and studio membership required'; end if;
 select * into w from public.formatix_workspaces where id=m.workspace_id for update;
 if w.revision<>expected_revision then raise exception 'Records changed in another session. Refresh cloud records before saving again.'; end if;
 if jsonb_typeof(next_state->'quotes')<>'array' or jsonb_typeof(next_state->'services')<>'array' or jsonb_typeof(next_state->'followups')<>'array' or jsonb_typeof(next_state->'customerNotes')<>'object' or jsonb_typeof(next_state->'settings')<>'object' then raise exception 'Invalid workspace data'; end if;
 if length(next_state::text)>5000000 then raise exception 'Workspace payload too large'; end if;
 if (next_state->'settings'->>'validity')::integer not between 1 and 365 or length(trim(next_state->'settings'->>'company'))=0 or length(trim(next_state->'settings'->>'prefix'))=0 then raise exception 'Invalid company settings'; end if;
 if m.role<>'Admin' and (next_state->'services' is distinct from w.state->'services' or next_state->'settings' is distinct from w.state->'settings') then raise exception 'Only Admins may modify catalog or settings'; end if;
 -- Rebuild relational projections inside this transaction; snapshots are preserved in state.
 delete from public.formatix_followups where workspace_id=w.id;
 delete from public.formatix_quotations where workspace_id=w.id;
 delete from public.formatix_vehicles where workspace_id=w.id;
 delete from public.formatix_customers where workspace_id=w.id;
 delete from public.formatix_services where workspace_id=w.id;
 for s in select value from jsonb_array_elements(next_state->'services') loop
 if length(trim(s->>'name'))=0 then raise exception 'Service name required'; end if;
 insert into public.formatix_services values(w.id,s->>'id',s->>'name',s->>'category',s->>'description',(s->>'active')::boolean,position);position:=position+1;
 for price in select * from jsonb_each_text(s->'prices') loop
 if price.value::numeric<>trunc(price.value::numeric) then raise exception 'Prices must be integer paise'; end if;
 insert into public.formatix_vehicle_prices values(w.id,s->>'id',price.key,price.value::bigint);
 end loop;
 end loop;
 for q in select value from jsonb_array_elements(next_state->'quotes') loop
 if coalesce(q->>'phone','') !~ '^[0-9]{10}$' or length(trim(coalesce(q->>'customer','')))=0 then raise exception 'Customer name and valid phone required'; end if;
 if q->>'status'<>'Draft' and (length(trim(coalesce(q->>'model','')))=0 or jsonb_array_length(q->'items')=0) then raise exception 'Vehicle and service required'; end if;
 select value into old_q from jsonb_array_elements(w.state->'quotes') where value->>'id'=q->>'id';
 subtotal:=0;
 for i in select value from jsonb_array_elements(q->'items') loop
 if (i->>'price')::numeric<>trunc((i->>'price')::numeric) or (i->>'price')::numeric<0 or length(trim(i->>'name'))=0 then raise exception 'Invalid line item'; end if;
 subtotal:=subtotal+(i->>'price')::bigint;
 if m.role<>'Admin' then
 select value into old_i from jsonb_array_elements(coalesce(old_q->'items','[]'::jsonb)) where value->>'id'=i->>'id';
 if old_i is null or i is distinct from old_i then
 select value into s from jsonb_array_elements(next_state->'services') where value->>'id'=i->>'serviceId' and (value->>'active')::boolean;
 if s is null or (s ? 'applicableCategories' and not(s->'applicableCategories' ? (q->>'category'))) or i->>'name' is distinct from s->>'name' or (i->>'price')::bigint is distinct from (s->'prices'->>(q->>'category'))::bigint then raise exception 'Staff must use active services at approved catalog prices'; end if;
 end if;
 end if;
 end loop;
 if (q->>'discount')::numeric<>trunc((q->>'discount')::numeric) or (q->>'booking')::numeric<>trunc((q->>'booking')::numeric) then raise exception 'Amounts must be integer paise'; end if;
 if subtotal>1000000000000 then raise exception 'Quotation value exceeds the supported limit'; end if;
 disc:=(q->>'discount')::bigint;booking:=(q->>'booking')::bigint;taxable:=round((subtotal-disc)*100::numeric/118);
 insert into public.formatix_customers values(w.id,q->>'phone',q->>'customer',q->>'source',next_state->'customerNotes'->>(q->>'phone')) on conflict(workspace_id,phone) do update set name=excluded.name,notes=excluded.notes;
 vehicle_key:=md5(concat_ws('|',q->>'phone',q->>'model',q->>'registration',q->>'colour'));
 insert into public.formatix_vehicles values(w.id,vehicle_key,q->>'phone',q->>'model',q->>'category',q->>'type',q->>'colour',q->>'registration') on conflict do nothing;
 insert into public.formatix_quotations(workspace_id,id,number,customer_phone,vehicle_id,date,staff,status,subtotal_paise,discount_paise,taxable_paise,gst_paise,booking_paise,snapshot)
 values(w.id,(q->>'id')::uuid,q->>'number',q->>'phone',vehicle_key,(q->>'date')::date,q->>'staff',q->>'status',subtotal,disc,taxable,subtotal-disc-taxable,booking,q);
 for i in select value from jsonb_array_elements(q->'items') loop
 insert into public.formatix_quotation_items values(w.id,(q->>'id')::uuid,(i->>'id')::uuid,i->>'serviceId',i->>'name',(i->>'price')::bigint);
 end loop;
 end loop;
 for f in select value from jsonb_array_elements(next_state->'followups') loop
 insert into public.formatix_followups values(w.id,(f->>'id')::uuid,(f->>'quoteId')::uuid,(f->>'date')::date,f->>'employee',f->>'priority',f->>'notes',(f->>'done')::boolean);
 end loop;
 insert into public.formatix_settings(workspace_id,details) values(w.id,next_state->'settings') on conflict(workspace_id) do update set details=excluded.details;
 update public.formatix_workspaces set state=next_state,revision=revision+1 where id=w.id;
 insert into public.formatix_audit_logs(workspace_id,actor,action,revision) values(w.id,auth.uid(),'workspace_saved',w.revision+1);
 return w.revision+1;
end $$;

create function public.formatix_create(initial_state jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare wid uuid; account_email text;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 if exists(select 1 from public.formatix_members where user_id=auth.uid()) then raise exception 'You already belong to a workspace'; end if;
 select email into account_email from auth.users where id=auth.uid();
 -- A new cloud workspace always starts with no customer/demo records.
 initial_state:=initial_state || '{"quotes":[],"services":[],"followups":[],"customerNotes":{}}'::jsonb;
 insert into public.formatix_workspaces(owner_id,state) values(auth.uid(),initial_state) returning id into wid;
 insert into public.formatix_members values(auth.uid(),wid,split_part(account_email,'@',1),account_email,'Admin');
 perform public.formatix_save(initial_state,0);
 return wid;
end $$;

create function public.formatix_member(member_email text,member_name text,member_role text) returns void language plpgsql security definer set search_path=public as $$
declare m public.formatix_members; target uuid; owner uuid;
begin
 select * into m from public.formatix_members where user_id=auth.uid();
 if m.role is distinct from 'Admin' then raise exception 'Admin access required'; end if;
 if member_role not in ('Admin','Staff') or length(trim(member_name))=0 then raise exception 'Invalid member details'; end if;
 select id into target from auth.users where lower(email)=lower(trim(member_email));
 if target is null then raise exception 'Employee must register an account first'; end if;
 select owner_id into owner from public.formatix_workspaces where id=m.workspace_id;
 if target=owner and member_role<>'Admin' then raise exception 'The workspace owner must remain an Admin'; end if;
 if exists(select 1 from public.formatix_members where user_id=target and workspace_id<>m.workspace_id) then raise exception 'This account already belongs to another workspace'; end if;
 insert into public.formatix_members values(target,m.workspace_id,member_name,lower(trim(member_email)),member_role) on conflict(user_id) do update set name=excluded.name,role=excluded.role;
 insert into public.formatix_audit_logs(workspace_id,actor,action,revision) select m.workspace_id,auth.uid(),'member_updated:'||target::text,revision from public.formatix_workspaces where id=m.workspace_id;
end $$;

revoke all on function public.formatix_load(),public.formatix_save(jsonb,integer),public.formatix_create(jsonb),public.formatix_member(text,text,text) from public;
grant execute on function public.formatix_load(),public.formatix_save(jsonb,integer),public.formatix_create(jsonb),public.formatix_member(text,text,text) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('formatix-quotes','formatix-quotes',false,10485760,array['application/pdf']) on conflict(id) do nothing;
create policy formatix_pdf_insert on storage.objects for insert to authenticated with check(bucket_id='formatix-quotes' and (storage.foldername(name))[1]=public.formatix_workspace()::text);
create policy formatix_pdf_read on storage.objects for select to authenticated using(bucket_id='formatix-quotes' and (storage.foldername(name))[1]=public.formatix_workspace()::text);
create index formatix_quotes_date on public.formatix_quotations(workspace_id,date desc);
create index formatix_followups_date on public.formatix_followups(workspace_id,followup_date) where not done;
