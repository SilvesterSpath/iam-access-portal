<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { getAuditLogs } from '../api';
import type { AuditLog } from '../types';

const props = defineProps<{
  reloadToken: number;
}>();

const logs = ref<AuditLog[]>([]);
const loading = ref(false);
const error = ref('');

function formatDetails(log: AuditLog) {
  const details = log.details ?? {};
  if (log.action === 'ROLES_UPDATED') {
    const before = details.beforeRoleNames?.join(', ') || '—';
    const after = details.afterRoleNames?.join(', ') || '—';
    return `${before} → ${after}`;
  }
  if (log.action === 'USER_CREATED') {
    const roles = details.roleNames?.join(', ') || '—';
    return `roles: ${roles}`;
  }
  return JSON.stringify(details);
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    logs.value = await getAuditLogs();
  } catch (err) {
    error.value =
      err instanceof Error ? err.message : 'Failed to load audit logs';
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void load();
});

watch(
  () => props.reloadToken,
  () => {
    void load();
  },
);
</script>

<template>
  <section class="panel">
    <div class="panel-header">
      <h2>Audit Log</h2>
      <button type="button" :disabled="loading" @click="load">Refresh</button>
    </div>

    <p v-if="loading" class="status">Loading audit history…</p>
    <p v-if="error" class="error">{{ error }}</p>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Actor</th>
            <th>Action</th>
            <th>Target user</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in logs" :key="log.id">
            <td>{{ new Date(log.createdAt).toLocaleString() }}</td>
            <td>{{ log.actorEmail }}</td>
            <td>{{ log.action }}</td>
            <td>
              {{
                log.targetUser
                  ? `${log.targetUser.name} (${log.targetUser.email})`
                  : log.targetUserId
              }}
            </td>
            <td>{{ formatDetails(log) }}</td>
          </tr>
          <tr v-if="!loading && logs.length === 0">
            <td colspan="5">No audit entries yet.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
