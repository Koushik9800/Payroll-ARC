(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const EMP_KEY = "arcPayrollEmployeesV1";
  const HIST_KEY = "arcPayrollHistoryV1";
  const NET_KEY = "arcPayrollNetworkV1";

  let selectedNetwork =
    localStorage.getItem(NET_KEY) || "testnet";

  let provider = null;
  let signer = null;
  let account = null;
  let pendingPayroll = [];

  let employees = loadJson(EMP_KEY, []);
  let history = loadJson(HIST_KEY, []);

  function loadJson(key, fallback) {
    try {
      return JSON.parse(
        localStorage.getItem(key) ||
        JSON.stringify(fallback)
      );
    } catch {
      return fallback;
    }
  }

  function saveAll() {
    localStorage.setItem(
      EMP_KEY,
      JSON.stringify(employees)
    );

    localStorage.setItem(
      HIST_KEY,
      JSON.stringify(history)
    );
  }

  function network() {
    return ARC_CONFIG[selectedNetwork];
  }

  function showMessage(text, type = "") {
    const el = $("message");

    if (!el) return;

    el.textContent = text;
    el.className = "message " + type;

    clearTimeout(showMessage.timer);

    showMessage.timer = setTimeout(() => {
      el.classList.add("hidden");
    }, 7000);
  }

  function shortAddr(address) {
    if (!address) return "—";

    return (
      address.slice(0, 6) +
      "…" +
      address.slice(-4)
    );
  }

  function money(value) {
    return Number(value || 0).toLocaleString(
      undefined,
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6
      }
    );
  }

  function monthKey(date = new Date()) {
    const d = new Date(date);

    return `${d.getFullYear()}-${String(
      d.getMonth() + 1
    ).padStart(2, "0")}`;
  }

  function initHistoryMonths() {
    const select = $("historyMonth");

    if (!select) return;

    const months = new Set(
      history.map((item) => item.month)
    );

    months.add(monthKey());

    const arr = [...months].sort().reverse();

    select.innerHTML = arr
      .map(
        (month) =>
          `<option value="${month}">${month}</option>`
      )
      .join("");

    renderHistory();
  }

  async function connectWallet() {
    if (!window.ethereum) {
      showMessage(
        "No EVM wallet detected. Please install MetaMask or another compatible wallet.",
        "error"
      );

      return;
    }

    try {
      await switchNetwork(true);

      provider =
        new ethers.BrowserProvider(
          window.ethereum
        );

      await provider.send(
        "eth_requestAccounts",
        []
      );

      signer = await provider.getSigner();

      account =
        await signer.getAddress();

      $("connectBtn").classList.add(
        "hidden"
      );

      $("disconnectBtn").classList.remove(
        "hidden"
      );

      $("walletAddress").textContent =
        shortAddr(account);

      await refreshBalance();

      showMessage(
        `Connected: ${shortAddr(account)}`,
        "success"
      );

    } catch (error) {
      showMessage(
        cleanError(error),
        "error"
      );
    }
  }

  async function switchNetwork(autoAdd = false) {
    if (!window.ethereum) {
      throw new Error(
        "No EVM wallet detected."
      );
    }

    const n = network();

    try {
      await window.ethereum.request({
        method:
          "wallet_switchEthereumChain",

        params: [
          {
            chainId: n.chainHex
          }
        ]
      });

    } catch (error) {

      if (
        error.code === 4902 ||
        autoAdd
      ) {

        const params = {
          chainId: n.chainHex,

          chainName: n.name,

          nativeCurrency: {
            name: "USDC",
            symbol: "USDC",
            decimals: 18
          },

          rpcUrls: [
            n.rpc
          ],

          blockExplorerUrls: [
            n.explorer
          ]
        };

        await window.ethereum.request({
          method:
            "wallet_addEthereumChain",

          params: [params]
        });

      } else {
        throw error;
      }
    }
  }

  async function handleNetworkChange() {

    selectedNetwork =
      $("networkSelect").value;

    localStorage.setItem(
      NET_KEY,
      selectedNetwork
    );

    updateNetworkUI();

    if (
      window.ethereum &&
      account
    ) {

      try {

        await switchNetwork(false);

        provider =
          new ethers.BrowserProvider(
            window.ethereum
          );

        signer =
          await provider.getSigner();

        await refreshBalance();

        showMessage(
          `Switched to ${network().name}`,
          "success"
        );

      } catch {
        showMessage(
          "Network switch cancelled or unavailable.",
          "error"
        );
      }
    }
  }

  async function refreshBalance() {

    if (!account) return;

    try {

      provider =
        provider ||
        new ethers.BrowserProvider(
          window.ethereum
        );

      const token =
        new ethers.Contract(
          network().usdc,
          USDC_ABI,
          provider
        );

      const [
        tokenRaw,
        nativeRaw
      ] = await Promise.all([
        token.balanceOf(account),
        provider.getBalance(account)
      ]);

      $("usdcBalance").textContent =
        money(
          ethers.formatUnits(
            tokenRaw,
            6
          )
        ) +
        " USDC";

      $("nativeBalance").textContent =
        "Gas balance: " +
        money(
          ethers.formatUnits(
            nativeRaw,
            18
          )
        ) +
        " USDC";

    } catch (error) {

      showMessage(
        "Could not read USDC balance: " +
        cleanError(error),
        "error"
      );
    }
  }

  function updateNetworkUI() {

    const n = network();

    $("networkSelect").value =
      selectedNetwork;

    $("networkName").textContent =
      n.name;

    $("chainIdText").textContent =
      "Chain " + n.chainId;
  }

  function renderEmployees() {

    const query =
      $("employeeSearch")
        .value
        .trim()
        .toLowerCase();

    const rows =
      employees.filter(
        (employee) => {

          return (
            !query ||
            employee.name
              .toLowerCase()
              .includes(query) ||

            employee.wallet
              .toLowerCase()
              .includes(query)
          );
        }
      );

    $("employeeCount").textContent =
      employees.length;

    $("emptyEmployees").classList.toggle(
      "hidden",
      rows.length !== 0
    );

    $("employeeTable").innerHTML =
      rows
        .map((employee) => {

          const lastPayment =
            [...history]
              .reverse()
              .find(
                (item) =>
                  item.employeeId ===
                    employee.id &&
                  item.status === "paid"
              );

          return `
            <tr>

              <td>
                <div class="employee-name">
                  ${escapeHtml(employee.name)}
                </div>

                <div class="muted">
                  ${escapeHtml(employee.id)}
                </div>
              </td>

              <td class="wallet">
                ${escapeHtml(
                  shortAddr(
                    employee.wallet
                  )
                )}
              </td>

              <td>
                ${money(
                  employee.salary
                )} USDC
              </td>

              <td>
                ${
                  lastPayment
                    ? `
                      <span class="status paid">
                        Paid
                      </span>
                    `
                    : `
                      <span class="status pending">
                        Ready
                      </span>
                    `
                }
              </td>

              <td>
                <div class="actions">

                  <button
                    class="btn mini"
                    data-pay="${employee.id}">
                    Pay
                  </button>

                  <button
                    class="btn mini"
                    data-edit="${employee.id}">
                    Edit
                  </button>

                  <button
                    class="btn mini"
                    data-remove="${employee.id}">
                    Remove
                  </button>

                </div>
              </td>

            </tr>
          `;
        })
        .join("");
  }

  function renderHistory() {

    const selected =
      $("historyMonth").value ||
      monthKey();

    const rows =
      history
        .filter(
          (item) =>
            item.month === selected
        )
        .sort(
          (a, b) =>
            b.timestamp -
            a.timestamp
        );

    $("emptyHistory").classList.toggle(
      "hidden",
      rows.length !== 0
    );

    $("historyTable").innerHTML =
      rows
        .map((item) => {

          const tx =
            item.txHash &&
            item.txHash.startsWith("0x")
              ? `
                <a
                  href="${network().explorer}/tx/${item.txHash}"
                  target="_blank"
                  rel="noopener">
                  ${shortAddr(item.txHash)}
                </a>
              `
              : "—";

          return `
            <tr>

              <td>
                ${new Date(
                  item.timestamp
                ).toLocaleString()}
              </td>

              <td>
                ${escapeHtml(
                  item.employeeName
                )}
              </td>

              <td>
                ${money(
                  item.amount
                )} USDC
              </td>

              <td>
                <span
                  class="status ${item.status}">
                  ${item.status}
                </span>
              </td>

              <td>
                ${tx}
              </td>

            </tr>
          `;
        })
        .join("");

    const currentMonth =
      monthKey();

    const paid =
      history.filter(
        (item) =>
          item.month ===
            currentMonth &&
          item.status === "paid"
      );

    const total =
      paid.reduce(
        (sum, item) =>
          sum + Number(item.amount),
        0
      );

    $("monthPaid").textContent =
      money(total) +
      " USDC";

    $("monthPayments").textContent =
      paid.length +
      " payments";
  }

  function openEmployeeModal(
    employee = null
  ) {

    $("employeeForm").reset();

    $("employeeId").value =
      employee?.id || "";

    $("employeeName").value =
      employee?.name || "";

    $("employeeWallet").value =
      employee?.wallet || "";

    $("employeeSalary").value =
      employee?.salary || "";

    $("modalTitle").textContent =
      employee
        ? "Edit Employee"
        : "Add Employee";

    $("employeeModal")
      .classList
      .remove("hidden");
  }

  function closeEmployeeModal() {

    $("employeeModal")
      .classList
      .add("hidden");
  }

  function saveEmployee(event) {

    event.preventDefault();

    const id =
      $("employeeId").value ||
      "EMP-" +
        Date.now()
          .toString(36)
          .toUpperCase();

    const name =
      $("employeeName")
        .value
        .trim();

    const walletRaw =
      $("employeeWallet")
        .value
        .trim();

    const salary =
      Number(
        $("employeeSalary")
          .value
      );

    if (!name) {

      showMessage(
        "Employee name is required.",
        "error"
      );

      return;
    }

    if (
      !ethers.isAddress(
        walletRaw
      )
    ) {

      showMessage(
        "Invalid wallet address.",
        "error"
      );

      return;
    }

    if (!(salary > 0)) {

      showMessage(
        "Salary must be greater than zero.",
        "error"
      );

      return;
    }

    const wallet =
      ethers.getAddress(
        walletRaw
      );

    const duplicate =
      employees.find(
        (employee) =>
          employee.wallet
            .toLowerCase() ===
            wallet.toLowerCase() &&
          employee.id !== id
      );

    if (duplicate) {

      showMessage(
        "This wallet is already assigned to another employee.",
        "error"
      );

      return;
    }

    const record = {
      id,
      name,
      wallet,
      salary
    };

    const index =
      employees.findIndex(
        (employee) =>
          employee.id === id
      );

    if (index >= 0) {

      employees[index] =
        record;

    } else {

      employees.push(record);
    }

    saveAll();

    closeEmployeeModal();

    renderEmployees();

    showMessage(
      "Employee saved successfully.",
      "success"
    );
  }

  function removeEmployee(id) {

    const employee =
      employees.find(
        (item) =>
          item.id === id
      );

    if (!employee) return;

    if (
      !confirm(
        `Remove ${employee.name} from payroll?`
      )
    ) {
      return;
    }

    employees =
      employees.filter(
        (item) =>
          item.id !== id
      );

    saveAll();

    renderEmployees();

    showMessage(
      `${employee.name} removed from active payroll.`,
      "success"
    );
  }

  function openConfirm(list) {

    if (!list.length) {

      showMessage(
        "Select at least one employee.",
        "error"
      );

      return;
    }

    const total =
      list.reduce(
        (sum, employee) =>
          sum +
          Number(
            employee.salary
          ),
        0
      );

    pendingPayroll =
      list;

    $("confirmBody").innerHTML = `

      <div>
        <strong>
          ${list.length}
        </strong>

        employee${
          list.length > 1
            ? "s"
            : ""
        }

        ·

        <strong>
          ${money(total)} USDC
        </strong>
      </div>

      <div class="confirm-list">

        ${list
          .map(
            (employee) => `
              <div class="confirm-row">

                <span>
                  ${escapeHtml(
                    employee.name
                  )}
                </span>

                <strong>
                  ${money(
                    employee.salary
                  )}
                  USDC
                </strong>

              </div>
            `
          )
          .join("")}

      </div>
    `;

    $("confirmModal")
      .classList
      .remove("hidden");
  }

  function payEmployee(employee) {

    if (!employee) return;

    openConfirm([
      employee
    ]);
  }

  async function executePayroll() {

    if (
      !account ||
      !signer
    ) {

      showMessage(
        "Connect your company wallet first.",
        "error"
      );

      return;
    }

    if (
      !pendingPayroll.length
    ) {
      return;
    }

    $("confirmPayBtn")
      .disabled = true;

    try {

      await switchNetwork(false);

      provider =
        new ethers.BrowserProvider(
          window.ethereum
        );

      signer =
        await provider.getSigner();

      const token =
        new ethers.Contract(
          network().usdc,
          USDC_ABI,
          signer
        );

      for (
        const employee
        of pendingPayroll
      ) {

        const amount =
          ethers.parseUnits(
            String(
              employee.salary
            ),
            6
          );

        const balance =
          await token.balanceOf(
            account
          );

        if (
          balance < amount
        ) {

          throw new Error(
            `Insufficient USDC balance for ${employee.name}.`
          );
        }

        const tx =
          await token.transfer(
            employee.wallet,
            amount
          );

        addHistory(
          employee,
          "pending",
          tx.hash
        );

        renderHistory();

        showMessage(
          `Payment submitted for ${employee.name}. Waiting for confirmation...`
        );

        try {

          await tx.wait();

          updateHistory(
            tx.hash,
            "paid"
          );

          showMessage(
            `${employee.name} paid successfully.`,
            "success"
          );

        } catch {

          updateHistory(
            tx.hash,
            "failed"
          );

          throw new Error(
            `Transaction failed for ${employee.name}.`
          );
        }

        renderHistory();
      }

      saveAll();

      await refreshBalance();

      $("confirmModal")
        .classList
        .add("hidden");

      pendingPayroll = [];

      renderEmployees();

    } catch (error) {

      showMessage(
        cleanError(error),
        "error"
      );

    } finally {

      $("confirmPayBtn")
        .disabled = false;
    }
  }

  function addHistory(
    employee,
    status,
    txHash
  ) {

    history.push({

      id:
        "TX-" +
        Date.now()
          .toString(36),

      employeeId:
        employee.id,

      employeeName:
        employee.name,

      amount:
        Number(
          employee.salary
        ),

      status,

      txHash,

      month:
        monthKey(),

      timestamp:
        Date.now(),

      network:
        selectedNetwork
    });

    saveAll();
  }

  function updateHistory(
    txHash,
    status
  ) {

    const item =
      history.find(
        (entry) =>
          entry.txHash ===
          txHash
      );

    if (item) {

      item.status =
        status;
    }

    saveAll();
  }

  function bulkPayroll() {

    if (!employees.length) {

      showMessage(
        "Add employees before starting payroll.",
        "error"
      );

      return;
    }

    openConfirm(
      employees
    );
  }

  function importCsv(file) {

    const reader =
      new FileReader();

    reader.onload = () => {

      try {

        const lines =
          String(
            reader.result
          )
            .split(/\r?\n/)
            .filter(Boolean);

        if (
          lines.length < 2
        ) {

          throw new Error(
            "CSV is empty."
          );
        }

        const headers =
          lines
            .shift()
            .split(",")
            .map(
              (x) =>
                x
                  .trim()
                  .toLowerCase()
            );

        const idI =
          headers.indexOf(
            "id"
          );

        const nameI =
          headers.indexOf(
            "name"
          );

        const walletI =
          headers.indexOf(
            "wallet"
          );

        const salaryI =
          headers.indexOf(
            "salary"
          );

        if (
          nameI < 0 ||
          walletI < 0 ||
          salaryI < 0
        ) {

          throw new Error(
            "CSV needs name,wallet,salary columns."
          );
        }

        let added = 0;

        for (
          const line
          of lines
        ) {

          const cols =
            parseCsvLine(
              line
            );

          const name =
            (
              cols[nameI] ||
              ""
            ).trim();

          const walletRaw =
            (
              cols[walletI] ||
              ""
            ).trim();

          const salary =
            Number(
              cols[salaryI]
            );

          if (
            !name ||
            !ethers.isAddress(
              walletRaw
            ) ||
            !(salary > 0)
          ) {
            continue;
          }

          const wallet =
            ethers.getAddress(
              walletRaw
            );

          if (
            employees.some(
              (employee) =>
            employee.wallet
            .toLowerCase() ===
          wallet.toLowerCase()
      )
    ) {
      continue;
    }

    employees.push({
      id:
        (
          cols[idI] ||
          ""
        ).trim() ||
        "EMP-" +
          Math.random()
            .toString(36)
            .slice(2, 8)
            .toUpperCase(),

      name,

      wallet,

      salary
    });

    added++;
  }

  saveAll();

  renderEmployees();

  showMessage(
    `${added} employee(s) imported.`,
    "success"
  );

} catch (error) {

  showMessage(
    cleanError(error),
    "error"
  );
}

};

reader.readAsText(file);

}

function parseCsvLine(line) {

  const output = [];

  let current = "";

  let quoted = false;

  for (
    let i = 0;
    i < line.length;
    i++
  ) {

    const char =
      line[i];

    if (
      char === '"' &&
      line[i + 1] === '"'
    ) {

      current += '"';

      i++;

      continue;
    }

    if (
      char === '"'
    ) {

      quoted =
        !quoted;

      continue;
    }

    if (
      char === "," &&
      !quoted
    ) {

      output.push(
        current
      );

      current = "";

    } else {

      current += char;
    }
  }

  output.push(
    current
  );

  return output;
}

function exportCsv() {

  const month =
    $("historyMonth")
      .value ||
    monthKey();

  const rows =
    history.filter(
      (item) =>
        item.month === month
    );

  const csv = [
    [
      "Date",
      "Employee",
      "Amount USDC",
      "Status",
      "Tx Hash",
      "Network"
    ],

    ...rows.map(
      (item) => [
        new Date(
          item.timestamp
        ).toISOString(),

        item.employeeName,

        item.amount,

        item.status,

        item.txHash || "",

        item.network
      ]
    )
  ];

  const blob =
    new Blob(
      [
        csv
          .map(
            (row) =>
              row
                .map(csvCell)
                .join(",")
          )
          .join("\n")
      ],
      {
        type: "text/csv"
      }
    );

  const link =
    document.createElement(
      "a"
    );

  link.href =
    URL.createObjectURL(
      blob
    );

  link.download =
    `arc-payroll-${month}.csv`;

  link.click();

  URL.revokeObjectURL(
    link.href
  );
}

function csvCell(value) {

  return `"${String(
    value
  ).replaceAll(
    '"',
    '""'
  )}"`;
}

function escapeHtml(value) {

  return String(
    value
  ).replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      }[char])
  );
}

function cleanError(error) {

  const message =
    error?.shortMessage ||
    error?.reason ||
    error?.message ||
    String(error);

  if (
    /user rejected|denied|rejected/i.test(
      message
    )
  ) {

    return "Transaction or network switch was rejected in the wallet.";
  }

  return message
    .replace(
      /^Error:\s*/,
      ""
    )
    .slice(
      0,
      240
    );
}


// -----------------------------
// Event listeners
// -----------------------------

$("networkSelect")
  .addEventListener(
    "change",
    handleNetworkChange
  );

$("connectBtn")
  .addEventListener(
    "click",
    connectWallet
  );

$("disconnectBtn")
  .addEventListener(
    "click",
    () => {

      account = null;

      provider = null;

      signer = null;

      $("connectBtn")
        .classList
        .remove("hidden");

      $("disconnectBtn")
        .classList
        .add("hidden");

      $("walletAddress")
        .textContent =
        "Wallet not connected";

      $("usdcBalance")
        .textContent =
        "—";

      $("nativeBalance")
        .textContent =
        "Gas: —";
    }
  );

$("addEmployeeBtn")
  .addEventListener(
    "click",
    () =>
      openEmployeeModal()
  );

$("cancelModal")
  .addEventListener(
    "click",
    closeEmployeeModal
  );

$("closeModal")
  .addEventListener(
    "click",
    closeEmployeeModal
  );

$("employeeForm")
  .addEventListener(
    "submit",
    saveEmployee
  );

$("employeeSearch")
  .addEventListener(
    "input",
    renderEmployees
  );

$("bulkBtn")
  .addEventListener(
    "click",
    bulkPayroll
  );

$("csvBtn")
  .addEventListener(
    "click",
    () =>
      $("csvInput").click()
  );

$("csvInput")
  .addEventListener(
    "change",
    (event) => {

      if (
        event.target.files[0]
      ) {

        importCsv(
          event.target.files[0]
        );
      }

      event.target.value = "";
    }
  );

$("historyMonth")
  .addEventListener(
    "change",
    renderHistory
  );

$("exportBtn")
  .addEventListener(
    "click",
    exportCsv
  );

$("cancelConfirm")
  .addEventListener(
    "click",
    () => {

      $("confirmModal")
        .classList
        .add("hidden");

      pendingPayroll = [];
    }
  );

$("closeConfirm")
  .addEventListener(
    "click",
    () => {

      $("confirmModal")
        .classList
        .add("hidden");

      pendingPayroll = [];
    }
  );

$("confirmPayBtn")
  .addEventListener(
    "click",
    executePayroll
  );

$("employeeTable")
  .addEventListener(
    "click",
    (event) => {

      const pay =
        event.target
          .closest(
            "[data-pay]"
          )
          ?.dataset.pay;

      const edit =
        event.target
          .closest(
            "[data-edit]"
          )
          ?.dataset.edit;

      const remove =
        event.target
          .closest(
            "[data-remove]"
          )
          ?.dataset.remove;

      if (pay) {

        payEmployee(
          employees.find(
            (employee) =>
              employee.id === pay
          )
        );
      }

      if (edit) {

        openEmployeeModal(
          employees.find(
            (employee) =>
              employee.id === edit
          )
        );
      }

      if (remove) {

        removeEmployee(
          remove
        );
      }
    }
  );


// -----------------------------
// Wallet events
// -----------------------------

if (window.ethereum) {

  window.ethereum.on?.(
    "accountsChanged",
    async (accounts) => {

      if (!accounts.length) {

        $("disconnectBtn")
          .click();

        return;
      }

      account =
        ethers.getAddress(
          accounts[0]
        );

      $("walletAddress")
        .textContent =
        shortAddr(account);

      provider =
        new ethers.BrowserProvider(
          window.ethereum
        );

      signer =
        await provider.getSigner();

      refreshBalance();
    }
  );

  window.ethereum.on?.(
    "chainChanged",
    () =>
      window.location.reload()
  );
}


// -----------------------------
// Initial render
// -----------------------------

updateNetworkUI();

initHistoryMonths();

renderEmployees();

})();
