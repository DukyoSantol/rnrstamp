const API_BASE = '';

let currentFileData = null;

const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const filenameEl = document.getElementById('filename');
const pageCountEl = document.getElementById('pageCount');
const removeFileBtn = document.getElementById('removeFile');
const stampForm = document.getElementById('stampForm');
const processBtn = document.getElementById('processBtn');
const previewSection = document.getElementById('previewSection');
const pdfPreview = document.getElementById('pdfPreview');
const downloadBtn = document.getElementById('downloadBtn');
const resetBtn = document.getElementById('resetBtn');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');

const docNumberInput = document.getElementById('docNumber');
const dateInput = document.getElementById('date');
const timeInput = document.getElementById('time');
const receivedByInput = document.getElementById('receivedBy');
const positionSelect = document.getElementById('position');

let receiversList = [];

function setDefaultDateTime() {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    dateInput.value = dateStr;
    timeInput.value = `${hours}:${minutes}`;
}

setDefaultDateTime();
loadReceivers();
setInterval(setDefaultDateTime, 1000);

function loadReceivers() {
    fetch(`${API_BASE}/api/receivers`)
        .then(res => res.json())
        .then(data => {
            const defaults = data.receivers || ['Ellen Mancera', 'Shiely Dilangalen'];
            const saved = getSavedReceivers();
            const merged = [...new Set([...defaults, ...saved])];
            receiversList = merged;
            saveReceivers(merged);
            populateReceivers(merged);
        })
        .catch(() => {
            const saved = getSavedReceivers();
            receiversList = saved.length ? saved : ['Ellen Mancera', 'Shiely Dilangalen'];
            populateReceivers(receiversList);
        });
}

function getSavedReceivers() {
    try { return JSON.parse(localStorage.getItem('rnr_receivers') || '[]'); } catch { return []; }
}

function saveReceivers(list) {
    try { localStorage.setItem('rnr_receivers', JSON.stringify(list)); } catch {}
}

function populateReceivers(list) {
    receivedByInput.innerHTML = '<option value="">-- Select --</option>';
    list.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        receivedByInput.appendChild(opt);
    });
    const addOpt = document.createElement('option');
    addOpt.value = '__add__';
    addOpt.textContent = '+ Add User';
    receivedByInput.appendChild(addOpt);
    if (list.length > 0) receivedByInput.value = list[0];
}

receivedByInput.addEventListener('change', () => {
    if (receivedByInput.value === '__add__') addNewUser();
});

function addNewUser() {
    const name = prompt('Enter new user name:');
    if (!name || !name.trim()) {
        receivedByInput.value = receiversList[0] || '';
        return;
    }
    const trimmed = name.trim();
    if (receiversList.includes(trimmed)) {
        showToast('Already exists', 'error');
        receivedByInput.value = trimmed;
        return;
    }
    receiversList.push(trimmed);
    saveReceivers(receiversList);
    populateReceivers(receiversList);
    showToast(`"${trimmed}" added`, 'success');
}

receivedByInput.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const currentName = receivedByInput.value;
    if (!currentName || currentName === '' || currentName === '__add__') return;
    if (!confirm(`Remove "${currentName}" from the list?`)) return;
    receiversList = receiversList.filter(n => n !== currentName);
    saveReceivers(receiversList);
    populateReceivers(receiversList);
    showToast('User removed', 'success');
});

uploadZone.addEventListener('click', () => fileInput.click());

uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
});

uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('dragover');
});

uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) handleFile(files[0]);
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handleFile(e.target.files[0]);
});

function handleFile(file) {
    if (file.type !== 'application/pdf') {
        showToast('Please upload a PDF file', 'error');
        return;
    }
    if (file.size > 10 * 1024 * 1024) {
        showToast('File size must be less than 10MB', 'error');
        return;
    }
    currentFileData = file;
    uploadZone.style.display = 'none';
    fileInfo.style.display = 'flex';
    filenameEl.textContent = file.name;
    pageCountEl.textContent = `${(file.size / 1024).toFixed(0)} KB`;
    processBtn.disabled = false;
    showToast('File ready', 'success');
}

removeFileBtn.addEventListener('click', () => {
    currentFileData = null;
    fileInput.value = '';
    uploadZone.style.display = 'block';
    fileInfo.style.display = 'none';
    processBtn.disabled = true;
    resetPreview();
});

stampForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentFileData) {
        showToast('Please select a PDF file first', 'error');
        return;
    }

    const docNumber = docNumberInput.value.trim();
    if (!docNumber) {
        showToast('Please enter document number', 'error');
        return;
    }
    if (!dateInput.value || !timeInput.value) {
        showToast('Please enter date and time', 'error');
        return;
    }

    setLoading(true);

    try {
        const formData = new FormData();
        formData.append('pdf', currentFileData);
        formData.append('docNumber', docNumber);
        formData.append('date', dateInput.value);
        formData.append('time', timeInput.value);
        formData.append('receivedBy', receivedByInput.value.trim());
        formData.append('position', positionSelect.value);
        formData.append('pages', document.querySelector('input[name="pages"]:checked').value);

        const response = await fetch(`${API_BASE}/api/process`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            const pdfBlob = base64ToBlob(data.pdf, 'application/pdf');
            const pdfUrl = URL.createObjectURL(pdfBlob);
            pdfPreview.src = pdfUrl;
            previewSection.style.display = 'block';
            previewSection.scrollIntoView({ behavior: 'smooth' });
            showToast('PDF processed successfully', 'success');
        } else {
            showToast(data.error || 'Failed to process PDF', 'error');
        }
    } catch (error) {
        console.error('Processing error:', error);
        showToast('Failed to process PDF', 'error');
    } finally {
        setLoading(false);
    }
});

function base64ToBlob(base64, mimeType) {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
}

downloadBtn.addEventListener('click', () => {
    const pdfUrl = pdfPreview.src;
    if (!pdfUrl) return;
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = `stamped_${currentFileData ? currentFileData.name : 'document.pdf'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Download started', 'success');
});

resetBtn.addEventListener('click', resetForm);

function resetForm() {
    docNumberInput.value = '';
    receivedByInput.value = '';
    setDefaultDateTime();
    positionSelect.value = 'bottom-right';
    document.querySelector('input[name="pages"][value="all"]').checked = true;
    resetPreview();
}

function resetPreview() {
    previewSection.style.display = 'none';
    pdfPreview.src = '';
}

function setLoading(isLoading) {
    const btnText = processBtn.querySelector('.btn-text');
    const btnLoader = processBtn.querySelector('.btn-loader');
    if (isLoading) {
        btnText.style.display = 'none';
        btnLoader.style.display = 'inline-flex';
        processBtn.disabled = true;
    } else {
        btnText.style.display = 'inline';
        btnLoader.style.display = 'none';
        if (currentFileData) processBtn.disabled = false;
    }
}

function showToast(message, type = 'info') {
    toastMessage.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => toast.classList.remove('show'), 3000);
}
