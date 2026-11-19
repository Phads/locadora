"use strict";

/* ==========================================================================
   Configurações & Regras de Negócio
   ========================================================================== */

const BARBER_CAPACITY = 2;
const SLOT_INTERVAL_MINUTES = 30;
const MIN_LEAD_TIME_MINUTES = 30;
const BOOKING_WINDOW_DAYS = 14;
const WHATSAPP_NUMBER = "5581973178238";

const STORAGE_KEYS = {
  CLIENTS: "hn_c",
  SESSION: "hn_m",
  APPOINTMENTS: "hn_a"
};

const SERVICES = [
  { id: 1, name: "Barba", duration: 30, price: 30, group: "principal" },
  { id: 2, name: "Corte + barba", duration: 60, price: 55, group: "principal" },
  { id: 3, name: "Corte + barba + sobrancelha", duration: 60, price: 55, group: "principal" },
  { id: 4, name: "Botox", duration: 120, price: 90, group: "tratamento" }
];

const WEEKDAY_NAMES = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado"
];

const TAB_SECTIONS = ["agendar", "equipe", "duvidas", "onde"];

/* ==========================================================================
   Camada de Persistência Desacoplada (StorageService)
   ========================================================================== */

const StorageService = {
  _memory: {},
  _useMemoryOnly: false,

  _clone(value) {
    if (value === null || value === undefined) return value;
    return JSON.parse(JSON.stringify(value));
  },

  async _getItem(key, fallback) {
    if (!this._useMemoryOnly) {
      try {
        const raw = window.localStorage.getItem(key);
        if (raw !== null) {
          const parsed = JSON.parse(raw);
          this._memory[key] = this._clone(parsed);
          return parsed;
        }
      } catch (error) {
        this._useMemoryOnly = true;
      }
    }

    if (Object.prototype.hasOwnProperty.call(this._memory, key)) {
      return this._clone(this._memory[key]);
    }

    return this._clone(fallback);
  },

  async _setItem(key, value) {
    this._memory[key] = this._clone(value);

    if (!this._useMemoryOnly) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        this._useMemoryOnly = true;
      }
    }
  },

  async getClients() {
    return this._getItem(STORAGE_KEYS.CLIENTS, []);
  },

  async saveClients(clients) {
    await this._setItem(STORAGE_KEYS.CLIENTS, clients);
  },

  async addClient(client) {
    const clients = await this.getClients();
    clients.push(client);
    await this.saveClients(clients);
    return client;
  },

  async getSession() {
    return this._getItem(STORAGE_KEYS.SESSION, null);
  },

  async setSession(phone) {
    await this._setItem(STORAGE_KEYS.SESSION, phone);
  },

  async getAppointments() {
    return this._getItem(STORAGE_KEYS.APPOINTMENTS, []);
  },

  async saveAppointments(appointments) {
    await this._setItem(STORAGE_KEYS.APPOINTMENTS, appointments);
  },

  async addAppointment(appointment) {
    const appointments = await this.getAppointments();
    appointments.push(appointment);
    await this.saveAppointments(appointments);
    return appointment;
  },

  async updateAppointment(appointmentId, updates) {
    const appointments = await this.getAppointments();
    const target = appointments.find((item) => String(item.id) === String(appointmentId));
    if (!target) return null;
    Object.assign(target, updates);
    await this.saveAppointments(appointments);
    return target;
  },

  async deleteAppointment(appointmentId) {
    const appointments = await this.getAppointments();
    const filtered = appointments.filter((item) => String(item.id) !== String(appointmentId));
    await this.saveAppointments(filtered);
    return filtered;
  },

  async loadAll() {
    const [clients, currentPhone, appointments] = await Promise.all([
      this.getClients(),
      this.getSession(),
      this.getAppointments()
    ]);
    return { clients, currentPhone, appointments };
  }
};

/* ==========================================================================
   Estado da Aplicação & Utilitários
   ========================================================================== */

const state = {
  clients: [],
  currentPhone: null,
  appointments: [],
  selectedServiceIds: new Set(),
  selectedDate: null,
  selectedTime: null,
  pendingBooking: false,
  redirectAfterAuth: null,
  editingBooking: null,
  activeSection: "",
  currentRoute: ""
};

const selectEl = (selector, scope = document) => scope.querySelector(selector);
const padTwo = (value) => String(value).padStart(2, "0");
const formatMinutesToTime = (totalMinutes) =>
  `${padTwo(Math.floor(totalMinutes / 60))}:${padTwo(totalMinutes % 60)}`;
const formatCurrency = (value) => `R$ ${value.toFixed(2).replace(".", ",")}`;
const escapeHtml = (text) =>
  String(text).replace(/[&<>"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  }[char]));

const formatDateKey = (date) =>
  `${date.getFullYear()}-${padTwo(date.getMonth() + 1)}-${padTwo(date.getDate())}`;

const formatDateShort = (dateKey) => dateKey.split("-").reverse().join("/").slice(0, 5);

const formatPhone = (digits) =>
  digits.length === 11
    ? `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
    : `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;

const bookingDays = Array.from({ length: BOOKING_WINDOW_DAYS }, (_, index) => {
  const date = new Date();
  date.setDate(date.getDate() + index);
  return date;
});

function getBusinessWindows(date) {
  const weekday = date.getDay();
  if (weekday === 0) return [];
  const closingMinute = weekday === 6 ? 1140 : 1200;
  return [
    [540, 720],
    [780, closingMinute]
  ];
}

function getCurrentClient() {
  return state.clients.find((client) => client.tel === state.currentPhone) || null;
}

function getServiceById(serviceId) {
  return SERVICES.find((service) => service.id === Number(serviceId));
}

function calculateDuration(selectedIds) {
  return [...selectedIds].reduce((total, id) => {
    const service = getServiceById(id);
    return total + (service ? service.duration : 0);
  }, 0);
}

function calculateTotal(selectedIds) {
  return [...selectedIds].reduce((total, id) => {
    const service = getServiceById(id);
    return total + (service ? service.price : 0);
  }, 0);
}

function toggleServiceSelection(selectedIds, serviceId, isChecked) {
  const service = getServiceById(serviceId);
  if (!service) return;

  if (isChecked) {
    if (service.group === "principal") {
      SERVICES.forEach((item) => {
        if (item.group === "principal" && item.id !== service.id) {
          selectedIds.delete(item.id);
        }
      });
    }
    selectedIds.add(service.id);
  } else {
    selectedIds.delete(service.id);
  }
}

/* ==========================================================================
   Agenda & Cálculo de Horários Disponíveis
   ========================================================================== */

function getAvailableSlots(
  date,
  durationMinutes = calculateDuration(state.selectedServiceIds),
  excludeAppointmentId = null
) {
  if (!date || durationMinutes <= 0) return [];

  const dateKey = formatDateKey(date);
  const now = new Date();
  const minStartMinute =
    formatDateKey(now) === dateKey
      ? now.getHours() * 60 + now.getMinutes() + MIN_LEAD_TIME_MINUTES
      : 0;

  const availableSlots = [];

  getBusinessWindows(date).forEach(([windowStart, windowEnd]) => {
    for (
      let startMinute = windowStart;
      startMinute + durationMinutes <= windowEnd;
      startMinute += SLOT_INTERVAL_MINUTES
    ) {
      if (startMinute < minStartMinute) continue;

      const overlappingCount = state.appointments.filter(
        (appointment) =>
          String(appointment.id) !== String(excludeAppointmentId) &&
          appointment.date === dateKey &&
          appointment.s < startMinute + durationMinutes &&
          startMinute < appointment.s + appointment.dur
      ).length;

      if (overlappingCount < BARBER_CAPACITY) {
        availableSlots.push(startMinute);
      }
    }
  });

  return availableSlots;
}

/* ==========================================================================
   Renderização do Fluxo de Agendamento
   ========================================================================== */

function renderServices() {
  const container = selectEl("#svcs");
  container.innerHTML = SERVICES.map(
    (service) => `
      <label class="svc">
        <input type="checkbox" value="${service.id}" ${state.selectedServiceIds.has(service.id) ? "checked" : ""}>
        <b>${escapeHtml(service.name)}</b>
        <span>${service.duration} min</span>
        <em>${formatCurrency(service.price)}</em>
      </label>`
  ).join("");

  const checkboxes = container.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach((input) => {
    input.addEventListener("change", () => {
      toggleServiceSelection(state.selectedServiceIds, Number(input.value), input.checked);
      checkboxes.forEach((checkbox) => {
        checkbox.checked = state.selectedServiceIds.has(Number(checkbox.value));
      });
      state.selectedTime = null;
      renderSlots();
      renderSummary();
    });
  });
}

function renderDays() {
  const container = selectEl("#days");
  container.innerHTML = bookingDays
    .map((date) => {
      const dateKey = formatDateKey(date);
      const isClosed = getBusinessWindows(date).length === 0;
      const weekdayLabel = date
        .toLocaleDateString("pt-BR", { weekday: "short" })
        .replace(".", "");

      return `
        <label class="chip">
          <input type="radio" name="dia" value="${dateKey}" ${isClosed ? "disabled" : ""} ${state.selectedDate === dateKey ? "checked" : ""}>
          <span>${weekdayLabel}<b>${date.getDate()}</b></span>
        </label>`;
    })
    .join("");

  container.querySelectorAll('input[type="radio"]').forEach((input) => {
    input.addEventListener("change", () => {
      state.selectedDate = input.value;
      state.selectedTime = null;
      renderSlots();
      renderSummary();
    });
  });
}

function renderSlots() {
  const container = selectEl("#slots");

  if (!state.selectedServiceIds.size || !state.selectedDate) {
    container.innerHTML = "<p>Escolha os serviços e o dia para ver os horários.</p>";
    return;
  }

  const chosenDate = bookingDays.find((date) => formatDateKey(date) === state.selectedDate);
  const available = getAvailableSlots(chosenDate);

  if (state.selectedTime !== null && !available.includes(state.selectedTime)) {
    state.selectedTime = null;
  }

  container.innerHTML = available.length
    ? available
        .map(
          (slotMinute) => `
            <label class="chip t">
              <input type="radio" name="hora" value="${slotMinute}" ${state.selectedTime === slotMinute ? "checked" : ""}>
              <span>${formatMinutesToTime(slotMinute)}</span>
            </label>`
        )
        .join("")
    : "<p>Sem horários nesse dia para o tempo escolhido. Tente outro dia.</p>";

  container.querySelectorAll('input[type="radio"]').forEach((input) => {
    input.addEventListener("change", () => {
      state.selectedTime = Number(input.value);
      renderSummary();
    });
  });
}

function renderSummary() {
  const selectedServices = [...state.selectedServiceIds]
    .map(getServiceById)
    .filter(Boolean);

  selectEl("#sl").innerHTML =
    selectedServices.map((service) => `<li>${escapeHtml(service.name)}</li>`).join("") ||
    "<li>Nenhum serviço marcado</li>";

  selectEl("#st").textContent = selectedServices.length
    ? `${calculateDuration(state.selectedServiceIds)} min`
    : "A definir";

  selectEl("#sp").textContent = formatCurrency(calculateTotal(state.selectedServiceIds));

  selectEl("#sw").textContent =
    state.selectedDate && state.selectedTime !== null
      ? `${formatDateShort(state.selectedDate)} às ${formatMinutesToTime(state.selectedTime)}`
      : "A definir";

  const isReady = Boolean(
    state.selectedServiceIds.size && state.selectedDate && state.selectedTime !== null
  );
  const confirmButton = selectEl("#ok");
  confirmButton.disabled = !isReady;

  if (isReady) {
    const client = getCurrentClient();
    selectEl("#msg").textContent = client
      ? `Agendando como ${client.nome.split(" ")[0]}.`
      : "Você faz um cadastro rápido antes de confirmar.";
  }
}

async function confirmBooking() {
  const client = getCurrentClient();
  if (!client) {
    state.pendingBooking = true;
    openAuthDialog("reg");
    return;
  }

  state.appointments = await StorageService.getAppointments();
  const chosenDate = bookingDays.find((date) => formatDateKey(date) === state.selectedDate);
  const available = getAvailableSlots(chosenDate);

  if (!available.includes(state.selectedTime)) {
    selectEl("#msg").textContent =
      "Esse horário acabou de ser preenchido. Escolha outro.";
    state.selectedTime = null;
    renderSlots();
    renderSummary();
    return;
  }

  const selectedServices = [...state.selectedServiceIds]
    .map(getServiceById)
    .filter(Boolean);

  const newAppointment = {
    id: Date.now(),
    tel: client.tel,
    date: state.selectedDate,
    s: state.selectedTime,
    dur: calculateDuration(state.selectedServiceIds),
    sv: selectedServices.map((service) => service.name),
    total: calculateTotal(state.selectedServiceIds)
  };

  await StorageService.addAppointment(newAppointment);
  state.appointments = await StorageService.getAppointments();

  const whatsappText = encodeURIComponent(
    `Olá! Sou ${client.nome} e agendei ${newAppointment.sv.join(", ")} para ${formatDateShort(newAppointment.date)} às ${formatMinutesToTime(newAppointment.s)}.`
  );

  selectEl("#msg").innerHTML =
    `Agendado: ${formatDateShort(newAppointment.date)} às ${formatMinutesToTime(newAppointment.s)}. ` +
    `<a href="https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappText}" target="_blank" rel="noopener">Avisar no WhatsApp</a>`;

  state.selectedTime = null;
  state.selectedServiceIds.clear();
  renderServices();
  renderSlots();

  selectEl("#st").textContent = "A definir";
  selectEl("#sp").textContent = formatCurrency(0);
  selectEl("#sw").textContent = "A definir";
  selectEl("#sl").innerHTML = "<li>Nenhum serviço marcado</li>";
  selectEl("#ok").disabled = true;
}

/* ==========================================================================
   Edição de Agendamento (Dentro de "Minha Conta")
   ========================================================================== */

function getEditAvailableSlots(editing) {
  const chosenDate = bookingDays.find((date) => formatDateKey(date) === editing.date);
  if (!chosenDate || !editing.selectedServiceIds.size) return [];
  return getAvailableSlots(
    chosenDate,
    calculateDuration(editing.selectedServiceIds),
    editing.id
  );
}

function renderEditAppointment(container, onDone) {
  const editing = state.editingBooking;
  if (!editing) return;

  container.innerHTML = `
    <fieldset>
      <legend>Serviços</legend>
      <div class="esv"></div>
    </fieldset>
    <fieldset>
      <legend>Dia</legend>
      <div class="chips edy"></div>
    </fieldset>
    <fieldset>
      <legend>Horário</legend>
      <div class="chips esl" aria-live="polite"></div>
    </fieldset>
    <div class="row" style="margin-top:20px"><span>Tempo</span><b class="et"></b></div>
    <div class="row"><span>Quando</span><b class="ew"></b></div>
    <div class="row"><span>Total</span><b class="ep"></b></div>
    <div class="msg em" role="status"></div>
    <div class="acts" style="margin-top:16px">
      <button class="b" type="button" id="es">Salvar alterações</button>
      <button class="b o" type="button" id="ev">Voltar sem salvar</button>
    </div>`;

  const query = (selector) => selectEl(selector, container);

  const updateEditSummary = () => {
    const isValid = Boolean(
      editing.selectedServiceIds.size && editing.date && editing.time !== null
    );
    query(".et").textContent = editing.selectedServiceIds.size
      ? `${calculateDuration(editing.selectedServiceIds)} min`
      : "Nenhum serviço";
    query(".ep").textContent = formatCurrency(calculateTotal(editing.selectedServiceIds));
    query(".ew").textContent = isValid
      ? `${formatDateShort(editing.date)} às ${formatMinutesToTime(editing.time)}`
      : "Escolha dia e horário";
    query("#es").disabled = !isValid;
  };

  const renderEditSlots = () => {
    const available = getEditAvailableSlots(editing);
    if (editing.time !== null && !available.includes(editing.time)) {
      editing.time = null;
    }

    const slotsEl = query(".esl");
    if (!editing.selectedServiceIds.size || !editing.date) {
      slotsEl.innerHTML = "<p>Escolha os serviços e o dia para ver os horários.</p>";
    } else if (available.length) {
      slotsEl.innerHTML = available
        .map(
          (slotMinute) => `
            <label class="chip t">
              <input type="radio" name="ed-hora" value="${slotMinute}" ${editing.time === slotMinute ? "checked" : ""}>
              <span>${formatMinutesToTime(slotMinute)}</span>
            </label>`
        )
        .join("");
    } else {
      slotsEl.innerHTML =
        "<p>Sem horários nesse dia para o tempo escolhido. Tente outro dia.</p>";
    }

    slotsEl.querySelectorAll('input[type="radio"]').forEach((input) => {
      input.addEventListener("change", () => {
        editing.time = Number(input.value);
        updateEditSummary();
      });
    });

    updateEditSummary();
  };

  const servicesEl = query(".esv");
  servicesEl.innerHTML = SERVICES.map(
    (service) => `
      <label class="svc">
        <input type="checkbox" value="${service.id}" ${editing.selectedServiceIds.has(service.id) ? "checked" : ""}>
        <b>${escapeHtml(service.name)}</b>
        <span>${service.duration} min</span>
        <em>${formatCurrency(service.price)}</em>
      </label>`
  ).join("");

  const serviceInputs = servicesEl.querySelectorAll('input[type="checkbox"]');
  serviceInputs.forEach((input) => {
    input.addEventListener("change", () => {
      toggleServiceSelection(editing.selectedServiceIds, Number(input.value), input.checked);
      serviceInputs.forEach((checkbox) => {
        checkbox.checked = editing.selectedServiceIds.has(Number(checkbox.value));
      });
      renderEditSlots();
    });
  });

  const daysEl = query(".edy");
  daysEl.innerHTML = bookingDays
    .map((date) => {
      const dateKey = formatDateKey(date);
      const isClosed = getBusinessWindows(date).length === 0;
      const weekdayLabel = date
        .toLocaleDateString("pt-BR", { weekday: "short" })
        .replace(".", "");

      return `
        <label class="chip">
          <input type="radio" name="ed-dia" value="${dateKey}" ${isClosed ? "disabled" : ""} ${editing.date === dateKey ? "checked" : ""}>
          <span>${weekdayLabel}<b>${date.getDate()}</b></span>
        </label>`;
    })
    .join("");

  daysEl.querySelectorAll('input[type="radio"]').forEach((input) => {
    input.addEventListener("change", () => {
      editing.date = input.value;
      renderEditSlots();
    });
  });

  query("#ev").addEventListener("click", onDone);

  query("#es").addEventListener("click", async () => {
    state.appointments = await StorageService.getAppointments();
    if (!getEditAvailableSlots(editing).includes(editing.time)) {
      query(".em").textContent =
        "Esse horário acabou de ser preenchido. Escolha outro.";
      renderEditSlots();
      return;
    }

    const updatedServices = [...editing.selectedServiceIds]
      .map(getServiceById)
      .filter(Boolean);

    await StorageService.updateAppointment(editing.id, {
      date: editing.date,
      s: editing.time,
      dur: calculateDuration(editing.selectedServiceIds),
      sv: updatedServices.map((service) => service.name),
      total: calculateTotal(editing.selectedServiceIds)
    });

    state.appointments = await StorageService.getAppointments();
    renderSlots();
    onDone();
  });

  renderEditSlots();
}

/* ==========================================================================
   Área "Minha Conta" (#conta) & Roteamento Unificado (navigateTo)
   ========================================================================== */

const mobileTabLinks = [...document.querySelectorAll(".tab a")];

function updateAccountUI() {
  const client = getCurrentClient();
  selectEl("#acct").textContent = client
    ? `Olá, ${client.nome.split(" ")[0]}`
    : "Entrar";
  selectEl("#tabc span").textContent = client ? "Conta" : "Entrar";
}

function setActiveTab(sectionId) {
  mobileTabLinks.forEach((link) => {
    if (link.dataset.t === sectionId) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

function renderAccountView() {
  const client = getCurrentClient();
  const accountMain = selectEl("#conta");
  if (!client) return;

  const getClientAppointments = () =>
    state.appointments
      .filter((appointment) => appointment.tel === client.tel)
      .sort((a, b) =>
        `${a.date}${formatMinutesToTime(a.s)}`.localeCompare(
          `${b.date}${formatMinutesToTime(b.s)}`
        )
      );

  const firstName = client.nome.split(" ")[0];
  const memberSinceHtml = client.desde
    ? `<dt>Cliente desde</dt><dd>${formatDateShort(client.desde)}/${client.desde.slice(0, 4)}</dd>`
    : "";

  accountMain.innerHTML = `
    <section class="acc">
      <div class="w">
        <a class="lk back" href="#agendar">← Voltar ao site</a>
        <span class="k">Minha conta</span>
        <h2>Olá, ${escapeHtml(firstName)}</h2>
        <div class="acc-g">
          <div class="acc-c">
            <h3>Meu cadastro</h3>
            <dl class="prof">
              <dt>Nome</dt>
              <dd>${escapeHtml(client.nome)}</dd>
              <dt>WhatsApp</dt>
              <dd>${formatPhone(client.tel)}</dd>
              <dt>E-mail</dt>
              <dd>${client.email ? escapeHtml(client.email) : "Não informado"}</dd>
              ${memberSinceHtml}
              <dt>Agendamentos marcados</dt>
              <dd id="acc-count">${getClientAppointments().length}</dd>
            </dl>
            <button class="b o" type="button" id="lo" style="width:100%;margin-top:24px">Sair da conta</button>
          </div>
          <div class="acc-a"></div>
        </div>
      </div>
    </section>`;

  selectEl("#lo", accountMain).addEventListener("click", async () => {
    await StorageService.setSession(null);
    state.currentPhone = null;
    state.editingBooking = null;
    updateAccountUI();
    renderSummary();
    navigateTo("");
  });

  const appointmentsArea = selectEl(".acc-a", accountMain);

  const renderAppointmentsList = () => {
    state.editingBooking = null;
    const appointments = getClientAppointments();
    const countEl = selectEl("#acc-count", accountMain);
    if (countEl) countEl.textContent = String(appointments.length);

    const listMarkup = appointments.length
      ? appointments
          .map(
            (appointment) => `
              <div class="ap">
                <div>
                  ${formatDateShort(appointment.date)} às ${formatMinutesToTime(appointment.s)}
                  <small>${escapeHtml(appointment.sv.join(", "))} · ${formatCurrency(appointment.total)}</small>
                </div>
                <div class="ac">
                  <button type="button" class="e" data-e="${appointment.id}">Editar</button>
                  <button type="button" data-c="${appointment.id}">Cancelar</button>
                </div>
              </div>`
          )
          .join("")
      : '<p style="margin:16px 0">Você ainda não tem horários marcados.</p>';

    appointmentsArea.innerHTML =
      `<h3>Meus agendamentos</h3>${listMarkup}` +
      '<a class="b" href="#agendar" style="margin-top:28px">Novo agendamento</a>';

    appointmentsArea.querySelectorAll("[data-e]").forEach((button) => {
      button.addEventListener("click", () => startEditAppointment(button.dataset.e));
    });

    appointmentsArea.querySelectorAll("[data-c]").forEach((button) => {
      button.addEventListener("click", () => {
        const appointment = state.appointments.find(
          (item) => String(item.id) === String(button.dataset.c)
        );
        if (appointment) {
          openCancelDialog(appointment);
        }
      });
    });
  };

  const startEditAppointment = (appointmentId) => {
    const appointment = state.appointments.find(
      (item) => String(item.id) === String(appointmentId)
    );
    if (!appointment) return;

    const matchedIds = SERVICES.filter((service) =>
      appointment.sv.includes(service.name)
    ).map((service) => service.id);

    state.editingBooking = {
      id: appointment.id,
      selectedServiceIds: new Set(matchedIds),
      date: bookingDays.some((date) => formatDateKey(date) === appointment.date)
        ? appointment.date
        : null,
      time: appointment.s
    };

    appointmentsArea.innerHTML =
      '<h3>Editar agendamento</h3><div class="ebox"></div>';
    renderEditAppointment(selectEl(".ebox", appointmentsArea), () =>
      renderAccountView()
    );
  };

  renderAppointmentsList();
}

function safeReplaceHistory(hashValue) {
  try {
    const nextUrl =
      hashValue || `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(null, "", nextUrl);
  } catch (error) {
    // Ambientes embutidos (ex.: srcdoc/iframes isolados) podem bloquear replaceState
  }
}

function navigateTo(targetHash = "", options = {}) {
  const { updateHistory = true, instantScroll = false } = options;
  const normalizedHash = targetHash
    ? targetHash.startsWith("#")
      ? targetHash
      : `#${targetHash}`
    : "";

  const accountMain = selectEl("#conta");
  const mainSite = selectEl("#top");

  if (normalizedHash === "#conta") {
    if (!getCurrentClient()) {
      if (updateHistory) safeReplaceHistory("");
      state.currentRoute = "";
      accountMain.hidden = true;
      mainSite.hidden = false;
      setActiveTab(state.activeSection);
      state.redirectAfterAuth = "#conta";
      openAuthDialog("in");
      return;
    }

    state.currentRoute = "#conta";
    if (updateHistory) safeReplaceHistory("#conta");
    accountMain.hidden = false;
    mainSite.hidden = true;
    setActiveTab("conta");
    renderAccountView();
    window.scrollTo(0, 0);
    return;
  }

  state.currentRoute = normalizedHash;
  if (updateHistory) safeReplaceHistory(normalizedHash);

  accountMain.hidden = true;
  mainSite.hidden = false;

  const sectionId = normalizedHash.replace(/^#/, "");
  if (TAB_SECTIONS.includes(sectionId)) {
    setActiveTab(sectionId);
  } else {
    setActiveTab(state.activeSection);
  }

  if (sectionId && sectionId !== "top") {
    const targetEl = document.getElementById(sectionId);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: instantScroll ? "auto" : "smooth" });
    }
  } else if (!instantScroll) {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

/* ==========================================================================
   Modais: Autenticação (openAuthDialog) & Confirmação (openCancelDialog)
   ========================================================================== */

const modalDialog = selectEl("#dlg");

function openCancelDialog(appointment) {
  const body = selectEl("#dbody");
  const title = selectEl("#dt");

  title.textContent = "Cancelar agendamento";

  body.innerHTML = `
    <p class="dlg-text">Tem certeza que deseja cancelar este horário? Essa ação não pode ser desfeita.</p>
    <div class="dlg-summary">
      <strong>${formatDateShort(appointment.date)} às ${formatMinutesToTime(appointment.s)}</strong>
      <span>${escapeHtml(appointment.sv.join(", "))} · ${formatCurrency(appointment.total)}</span>
    </div>
    <div class="acts dlg-acts">
      <button class="b danger" type="button" id="confirm-cancel">Sim, cancelar</button>
      <button class="b o" type="button" id="keep-booking">Manter horário</button>
    </div>`;

  selectEl("#keep-booking", body).addEventListener("click", () => {
    modalDialog.close();
  });

  const confirmButton = selectEl("#confirm-cancel", body);
  confirmButton.addEventListener("click", async () => {
    confirmButton.disabled = true;
    await StorageService.deleteAppointment(appointment.id);
    state.appointments = await StorageService.getAppointments();
    modalDialog.close();
    renderSlots();
    renderAccountView();
  });

  if (!modalDialog.open) {
    modalDialog.showModal();
  }
}

function openAuthDialog(mode = "in") {
  const body = selectEl("#dbody");
  const title = selectEl("#dt");
  const isRegister = mode === "reg";

  title.textContent = isRegister ? "Criar cadastro" : "Entrar";

  body.innerHTML = `
    <div class="tabs" role="tablist">
      <button type="button" role="tab" aria-selected="${isRegister}" data-v="reg">Cadastro</button>
      <button type="button" role="tab" aria-selected="${!isRegister}" data-v="in">Já sou cliente</button>
    </div>
    <form novalidate>
      ${
        isRegister
          ? '<label>Nome completo<input type="text" name="n" autocomplete="name"><span class="err"></span></label>'
          : ""
      }
      <label>WhatsApp com DDD
        <input type="tel" name="t" inputmode="tel" autocomplete="tel" placeholder="(81) 90000-0000">
        <span class="err"></span>
      </label>
      ${
        isRegister
          ? '<label>E-mail (opcional)<input type="email" name="e" autocomplete="email"><span class="err"></span></label>'
          : ""
      }
      <button class="b" type="submit">${isRegister ? "Cadastrar e continuar" : "Entrar"}</button>
    </form>`;

  body.querySelectorAll("[data-v]").forEach((tabButton) => {
    tabButton.addEventListener("click", () => openAuthDialog(tabButton.dataset.v));
  });

  selectEl("form", body).addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;

    const setFieldError = (fieldName, message) => {
      const input = form.elements[fieldName];
      if (!input) return;
      input.setAttribute("aria-invalid", String(Boolean(message)));
      input.nextElementSibling.textContent = message || "";
    };

    const phone = form.t.value.replace(/\D/g, "");
    const fullName = form.n ? form.n.value.trim() : "";
    let hasError = false;

    if (isRegister) {
      const nameParts = fullName.split(/\s+/).filter(Boolean);
      const isNameInvalid = nameParts.length < 2;
      setFieldError("n", isNameInvalid ? "Informe nome e sobrenome." : "");
      hasError = isNameInvalid;

      const email = form.e.value.trim();
      const isEmailInvalid = Boolean(email && !/^\S+@\S+\.\S+$/.test(email));
      setFieldError("e", isEmailInvalid ? "E-mail inválido." : "");
      hasError = hasError || isEmailInvalid;
    }

    const isPhoneInvalid = phone.length < 10 || phone.length > 11;
    setFieldError("t", isPhoneInvalid ? "Informe o DDD e o número." : "");

    if (hasError || isPhoneInvalid) return;

    state.clients = await StorageService.getClients();

    if (isRegister) {
      if (state.clients.some((client) => client.tel === phone)) {
        setFieldError("t", "Esse número já tem cadastro. Use “Já sou cliente”.");
        return;
      }

      await StorageService.addClient({
        nome: fullName,
        tel: phone,
        email: form.e.value.trim(),
        desde: formatDateKey(new Date())
      });
      state.clients = await StorageService.getClients();
    } else if (!state.clients.some((client) => client.tel === phone)) {
      setFieldError("t", "Não encontramos esse número. Faça o cadastro.");
      return;
    }

    const redirectTarget = state.redirectAfterAuth;
    state.redirectAfterAuth = null;

    await StorageService.setSession(phone);
    state.currentPhone = phone;

    updateAccountUI();
    modalDialog.close();
    renderSummary();

    if (state.pendingBooking) {
      state.pendingBooking = false;
      await confirmBooking();
    } else if (redirectTarget) {
      navigateTo(redirectTarget);
    }
  });

  if (!modalDialog.open) {
    modalDialog.showModal();
  }
}

/* ==========================================================================
   Horários de Atendimento, Observadores & Inicialização
   ========================================================================== */

function renderOpeningHours() {
  const today = new Date().getDay();
  const displayOrder = [1, 2, 3, 4, 5, 6, 0];

  selectEl("#hrs").innerHTML = displayOrder
    .map((weekday) => {
      const isToday = weekday === today;
      const hoursLabel =
        weekday === 0
          ? "Fechado"
          : weekday === 6
            ? "09:00–12:00 · 13:00–19:00"
            : "09:00–12:00 · 13:00–20:00";

      return `<dt class="${isToday ? "today" : ""}">${WEEKDAY_NAMES[weekday]}${isToday ? " · hoje" : ""}</dt><dd>${hoursLabel}</dd>`;
    })
    .join("");
}

function setupNavigationObservers() {
  if (!("IntersectionObserver" in window)) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          state.activeSection = entry.target.id;
        }
      });

      if (!selectEl("#conta").hidden) return;
      setActiveTab(state.activeSection);
    },
    { rootMargin: "-40% 0px -55% 0px" }
  );

  TAB_SECTIONS.forEach((sectionId) => {
    const section = document.getElementById(sectionId);
    if (section) observer.observe(section);
  });
}

function bindEvents() {
  // Interceptador global de âncoras internas para navegação unificada
  document.addEventListener("click", (event) => {
    const anchor = event.target.closest('a[href^="#"]');
    if (!anchor) return;

    const href = anchor.getAttribute("href");
    if (!href) return;

    event.preventDefault();
    navigateTo(href);
  });

  window.addEventListener("hashchange", () => {
    navigateTo(window.location.hash, { updateHistory: false });
  });

  selectEl("#acct").addEventListener("click", () => {
    if (getCurrentClient()) {
      navigateTo("#conta");
    } else {
      state.redirectAfterAuth = "#conta";
      openAuthDialog("in");
    }
  });

  selectEl("#cx").addEventListener("click", () => {
    state.pendingBooking = false;
    state.redirectAfterAuth = null;
    modalDialog.close();
  });

  document.querySelectorAll("[data-open]").forEach((button) => {
    button.addEventListener("click", () => {
      state.redirectAfterAuth = null;
      openAuthDialog(button.dataset.open);
    });
  });

  modalDialog.addEventListener("click", (event) => {
    if (event.target === modalDialog) {
      state.pendingBooking = false;
      state.redirectAfterAuth = null;
      modalDialog.close();
    }
  });

  selectEl("#ok").addEventListener("click", () => {
    confirmBooking();
  });
}

async function initApp() {
  const persisted = await StorageService.loadAll();
  state.clients = persisted.clients;
  state.currentPhone = persisted.currentPhone;
  state.appointments = persisted.appointments;

  renderOpeningHours();
  updateAccountUI();
  renderServices();
  renderDays();
  renderSlots();
  renderSummary();
  setupNavigationObservers();
  bindEvents();

  navigateTo(window.location.hash, { updateHistory: false, instantScroll: true });
}

initApp();
