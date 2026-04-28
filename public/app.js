const API_BASE = '';

let currentFileId = null;
let currentFilename = null;

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
const addUserBtn = document.getElementById('addUserBtn');

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

function loadReceivers() {
    fetch(`${API_BASE}/api/receivers`)
        .then(res => res.json())
        .then(data => {
            receiversList = data.receivers || [];
            receivedByInput.innerHTML = '<option value="">-- Select --</option>';
            receiversList.forEach(name => {
                const opt = document.createElement('option');
                opt.value = name;
                opt.textContent = name;
                receivedByInput.appendChild(opt);
            });
            // Add "Add User" option
            const addOpt = document.createElement('option');
            addOpt.value = '__add__';
            addOpt.textContent = '+ Add User';
            receivedByInput.appendChild(addOpt);
            
            if (receiversList.length > 0) {
                receivedByInput.value = receiversList[0];
            }
        })
        .catch(err => console.error('Error loading receivers:', err));
}

receivedByInput.addEventListener('change', () => {
    if (receivedByInput.value === '__add__') {
        addNewUser();
    }
});

function addNewUser() {
    const name = prompt('Enter new user name:');
    if (!name || !name.trim()) {
        receivedByInput.value = receiversList[0] || '';
        return;
    }
    
    fetch(`${API_BASE}/api/receivers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            loadReceivers();
            showToast('User added', 'success');
        } else {
            showToast(data.error || 'Failed to add', 'error');
            receivedByInput.value = receiversList[0] || '';
        }
    })
    .catch(err => {
        showToast('Failed to add user', 'error');
        receivedByInput.value = receiversList[0] || '';
    });
}

receivedByInput.addEventListener('contextmenu', async (e) => {
    e.preventDefault();
    const currentName = receivedByInput.value;
    if (!currentName || currentName === '' || currentName === '__add__') return;
    if (!confirm(`Delete "${currentName}" from the list?`)) return;
    
    try {
        const res = await fetch(`${API_BASE}/api/receivers`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: currentName })
        });
        const data = await res.json();
        if (data.success) {
            loadReceivers();
            showToast('User deleted', 'success');
        } else {
            showToast(data.error || 'Failed to delete', 'error');
        }
    } catch (err) {
        showToast('Failed to delete user', 'error');
    }
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
    if (files.length > 0) {
        handleFileUpload(files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFileUpload(e.target.files[0]);
    }
});

async function handleFileUpload(file) {
    if (file.type !== 'application/pdf') {
        showToast('Please upload a PDF file', 'error');
        return;
    }

    if (file.size > 50 * 1024 * 1024) {
        showToast('File size must be less than 50MB', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('pdf', file);

    try {
        const response = await fetch(`${API_BASE}/api/upload`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            currentFileId = data.fileId;
            currentFilename = data.filename;
            
            uploadZone.style.display = 'none';
            fileInfo.style.display = 'flex';
            filenameEl.textContent = data.filename;
            pageCountEl.textContent = `${data.pageCount} page${data.pageCount > 1 ? 's' : ''}`;
            
            processBtn.disabled = false;
            showToast('File uploaded successfully', 'success');
        } else {
            showToast(data.error || 'Failed to upload file', 'error');
        }
    } catch (error) {
        console.error('Upload error:', error);
        showToast('Failed to upload file', 'error');
    }
}

removeFileBtn.addEventListener('click', async () => {
    if (currentFileId) {
        try {
            await fetch(`${API_BASE}/api/cleanup/${currentFileId}`, {
                method: 'DELETE'
            });
        } catch (err) {
            console.error('Cleanup error:', err);
        }
    }
    
    currentFileId = null;
    currentFilename = null;
    fileInput.value = '';
    uploadZone.style.display = 'block';
    fileInfo.style.display = 'none';
    processBtn.disabled = true;
    resetPreview();
});

stampForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentFileId) {
        showToast('Please upload a PDF file first', 'error');
        return;
    }

    const formData = {
        fileId: currentFileId,
        docNumber: docNumberInput.value.trim(),
        date: dateInput.value,
        time: timeInput.value,
        receivedBy: receivedByInput.value.trim(),
        position: positionSelect.value,
        pages: document.querySelector('input[name="pages"]:checked').value
    };

    if (!formData.docNumber) {
        showToast('Please enter document number', 'error');
        return;
    }

    if (!formData.date || !formData.time) {
        showToast('Please enter date and time', 'error');
        return;
    }

    setLoading(true);

    try {
        const response = await fetch(`${API_BASE}/api/process`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
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
    link.download = `stamped_${currentFilename}`;
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
        
        if (currentFileId) {
            processBtn.disabled = false;
        }
    }
}

function showToast(message, type = 'info') {
    toastMessage.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

window.addEventListener('beforeunload', async () => {
    if (currentFileId) {
        try {
            await fetch(`${API_BASE}/api/cleanup/${currentFileId}`, {
                method: 'DELETE'
            });
        } catch (err) {
            console.error('Cleanup error:', err);
        }
    }
});