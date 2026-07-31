<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { createUser, getRoles, getUsers, updateUserRoles } from '../api';
import type { Role, User } from '../types';

const emit = defineEmits<{
  changed: [];
}>();

const users = ref<User[]>([]);
const roles = ref<Role[]>([]);
const loading = ref(false);
const error = ref('');
const success = ref('');
const savingUserId = ref<string | null>(null);
const creating = ref(false);

const draftRoles = reactive<Record<string, string[]>>({});
const draftReasons = reactive<Record<string, string>>({});

const newUser = reactive({
  name: '',
  email: '',
  roleIds: [] as string[],
});

async function load() {
  loading.value = true;
  error.value = '';
  success.value = '';
  try {
    const [nextUsers, nextRoles] = await Promise.all([getUsers(), getRoles()]);
    users.value = nextUsers;
    roles.value = nextRoles;
    for (const user of nextUsers) {
      draftRoles[user.id] = user.roles.map((role) => role.id);
      if (draftReasons[user.id] === undefined) {
        draftReasons[user.id] = '';
      }
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load users';
  } finally {
    loading.value = false;
  }
}

function toggleDraftRole(userId: string, roleId: string, checked: boolean) {
  const current = new Set(draftRoles[userId] ?? []);
  if (checked) {
    current.add(roleId);
  } else {
    current.delete(roleId);
  }
  draftRoles[userId] = [...current];
}

function isDraftChecked(userId: string, roleId: string) {
  return (draftRoles[userId] ?? []).includes(roleId);
}

function toggleNewUserRole(roleId: string, checked: boolean) {
  if (checked) {
    if (!newUser.roleIds.includes(roleId)) {
      newUser.roleIds.push(roleId);
    }
    return;
  }
  newUser.roleIds = newUser.roleIds.filter((id) => id !== roleId);
}

async function saveRoles(user: User) {
  savingUserId.value = user.id;
  error.value = '';
  success.value = '';
  try {
    const reason = (draftReasons[user.id] ?? '').trim();
    const updated = await updateUserRoles(user.id, {
      roleIds: draftRoles[user.id] ?? [],
      ...(reason ? { reason } : {}),
    });
    users.value = users.value.map((item) =>
      item.id === user.id ? updated : item,
    );
    draftRoles[user.id] = updated.roles.map((role) => role.id);
    draftReasons[user.id] = '';
    success.value = `Saved roles for ${updated.name}.`;
    emit('changed');
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to save roles';
  } finally {
    savingUserId.value = null;
  }
}

async function submitNewUser() {
  creating.value = true;
  error.value = '';
  success.value = '';
  try {
    await createUser({
      name: newUser.name.trim(),
      email: newUser.email.trim(),
      roleIds: [...newUser.roleIds],
    });
    newUser.name = '';
    newUser.email = '';
    newUser.roleIds = [];
    await load();
    success.value = 'User created.';
    emit('changed');
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to create user';
  } finally {
    creating.value = false;
  }
}

onMounted(() => {
  void load();
});
</script>

<template>
  <section class="panel">
    <div class="panel-header">
      <h2>User Management</h2>
      <button type="button" :disabled="loading" @click="load">Refresh</button>
    </div>

    <p v-if="loading" class="status">Loading users…</p>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="success" class="success">{{ success }}</p>

    <form class="add-user" @submit.prevent="submitNewUser">
      <h3>Add user</h3>
      <div class="form-row">
        <label>
          Name
          <input v-model="newUser.name" type="text" required />
        </label>
        <label>
          Email
          <input v-model="newUser.email" type="email" required />
        </label>
      </div>
      <fieldset>
        <legend>Roles</legend>
        <label v-for="role in roles" :key="role.id" class="check">
          <input
            type="checkbox"
            :checked="newUser.roleIds.includes(role.id)"
            @change="
              toggleNewUserRole(
                role.id,
                ($event.target as HTMLInputElement).checked,
              )
            "
          />
          {{ role.name }}
        </label>
      </fieldset>
      <button type="submit" :disabled="creating">
        {{ creating ? 'Creating…' : 'Create user' }}
      </button>
    </form>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Current roles</th>
            <th>Edit roles</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id">
            <td>{{ user.name }}</td>
            <td>{{ user.email }}</td>
            <td>{{ user.roles.map((role) => role.name).join(', ') || '—' }}</td>
            <td>
              <div class="checks">
                <label v-for="role in roles" :key="role.id" class="check">
                  <input
                    type="checkbox"
                    :checked="isDraftChecked(user.id, role.id)"
                    @change="
                      toggleDraftRole(
                        user.id,
                        role.id,
                        ($event.target as HTMLInputElement).checked,
                      )
                    "
                  />
                  {{ role.name }}
                </label>
              </div>
              <label class="reason-field">
                Reason (optional)
                <input
                  v-model="draftReasons[user.id]"
                  type="text"
                  placeholder="Why are roles changing?"
                />
              </label>
            </td>
            <td>
              <button
                type="button"
                :disabled="savingUserId === user.id"
                @click="saveRoles(user)"
              >
                {{ savingUserId === user.id ? 'Saving…' : 'Save' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
