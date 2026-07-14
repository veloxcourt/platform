# CourtFlow - Documento Maestro de Arquitectura

## 1. Visión del Proyecto

Objetivo: construir una plataforma SaaS multi-club para administrar integralmente clubes de pádel.
Características:
- Aplicación web responsive.
- Acceso desde PC, tablet y celular.
- Arquitectura escalable.
- Código modular.
- Pensada para miles de clubes.

## 2. Alcance General

Módulos previstos:
- Gestión de Turnos
- Torneos
- Socios
- Bar
- Caja
- Ranking
- Clases
- Videos
- Notificaciones
- Pagos
- Reportes
- Estadísticas
- Administración

## 3. Arquitectura

Modelo SaaS Multi-Tenant.
Entidad principal: Club.
Todos los datos deberán depender de ClubId.
No habrá instalaciones locales; una única plataforma atenderá todos los clubes.

## 4. Stack Tecnológico

Frontend: Next.js + React + TypeScript
UI: Tailwind CSS + shadcn/ui
Backend: Next.js API (evolucionable a NestJS)
Base de datos: PostgreSQL
ORM: Prisma
Auth: Supabase Auth
Storage: Supabase Storage
Realtime: Supabase Realtime
Formularios: React Hook Form + Zod
Datos: TanStack Query
Tablas: TanStack Table
App futura: React Native + Expo

## 5. Principios de Diseño

- Clean Architecture
- Componentes reutilizables
- Convenciones consistentes
- Separación estricta entre UI, negocio y datos
- APIs versionadas
- Seguridad por roles

## 6. Primer MVP

Módulo: Gestión de Torneos e Inscripción Online.
Incluye:
- Creación de torneos
- Link público
- Inscripción
- Disponibilidad horaria
- Gestión de participantes
- Confirmación de pagos
- Exportación
Debe quedar preparado para futuras funciones de fixture y ranking.

## 7. Roadmap

Fase 1: Torneos
Fase 2: Turnos
Fase 3: Socios
Fase 4: Caja y Bar
Fase 5: Ranking
Fase 6: Clases
Fase 7: Videos
Fase 8: App móvil

## 8. Reglas para Cursor

Antes de escribir código deberá:
1. Proponer estructura de carpetas.
2. Proponer arquitectura.
3. Proponer modelo de datos.
4. Esperar aprobación.
Nunca incorporar librerías no justificadas.
Nunca romper compatibilidad arquitectónica.
Priorizar mantenibilidad sobre velocidad.

## 9. Evolución del Documento

Este documento está diseñado para crecer hasta convertirse en la documentación completa del sistema (aprox. 150-300 páginas), incorporando diagramas, modelo de datos, APIs, UX, reglas de negocio y especificaciones de cada módulo.

