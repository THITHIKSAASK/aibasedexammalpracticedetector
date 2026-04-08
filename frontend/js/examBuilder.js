let examConfig = {
    title: '',
    subject: '',
    duration: 120,
    difficulty: 'Medium',
    type: 'MCQ',
    sectionCount: 1,
    targetClass: '',
    sections: [],
    mode: 'manual',
    pdfText: null
};

function setExamMode(mode) {
    examConfig.mode = mode;
    document.getElementById('exam-mode').value = mode;
    
    // UI update for 3 modes
    document.getElementById('mode-manual').classList.toggle('active', mode === 'manual');
    document.getElementById('mode-auto').classList.toggle('active', mode === 'auto');
    document.getElementById('mode-custom').classList.toggle('active', mode === 'custom');
    
    document.getElementById('pdf-upload-section').style.display = mode === 'auto' ? 'block' : 'none';
    
    // If custom, we might skip AI gen later
    if (mode === 'custom') {
        alert("Manual Entry: You will be prompted to enter questions manually in the next step.");
    }
}

async function handleSourceUpload() {
    const fileInput = document.getElementById('exam-source-file');
    const status = document.getElementById('upload-status');
    const file = fileInput.files[0];
    if (!file) return;

    status.innerText = "Extracting knowledge from source (" + file.type.split('/')[1].toUpperCase() + ")...";
    
    const formData = new FormData();
    formData.append('file', file);

    try {
        const res = await fetch('/api/teacher/extract-content', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (res.ok) {
            examConfig.pdfText = data.text;
            status.innerText = "✓ Knowledge Base Synchronized";
            status.style.color = "var(--success)";
        } else {
            status.innerText = "Error: " + data.error;
            status.style.color = "var(--danger)";
        }
    } catch (err) {
        status.innerText = "Upload failed: " + err.message;
        status.style.color = "var(--danger)";
    }
}

function navigateToSectionConfig() {
    examConfig.title = document.getElementById('exam-title').value.trim();
    examConfig.subject = document.getElementById('exam-subject').value;
    examConfig.duration = parseInt(document.getElementById('exam-duration').value);
    examConfig.difficulty = document.getElementById('exam-difficulty').value;
    examConfig.type = document.getElementById('exam-type').value;
    examConfig.sectionCount = parseInt(document.getElementById('exam-sections-count').value) || 1;
    examConfig.targetClass = document.getElementById('exam-target-class').value;

    if (!examConfig.title || !examConfig.subject || !examConfig.targetClass) {
        alert("Please provide an exam title, select a department, and enroll a target section.");
        return;
    }

    if (examConfig.mode === 'auto' && !examConfig.pdfText) {
        alert("Please upload and analyze a PDF for Auto-Generation mode.");
        return;
    }

    document.getElementById('builder-step-1').style.display = 'none';
    const step2 = document.getElementById('builder-step-2');
    step2.style.display = 'block';

    const renderArea = document.getElementById('dynamic-sections-render');
    renderArea.innerHTML = '';

    for(let i=1; i<=examConfig.sectionCount; i++) {
        if (examConfig.mode === 'custom') {
            // Manual question input
            renderArea.innerHTML += `
                <div class="card" style="margin-bottom: 25px; border: 1px solid var(--primary);">
                    <h4 style="margin-bottom: 12px; color:var(--primary);">Question ${i} (Direct Entry)</h4>
                    <input type="text" id="manual-q-text-${i}" placeholder="Enter Question Stem...">
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                        <input type="text" id="manual-q-o1-${i}" placeholder="Option 1">
                        <input type="text" id="manual-q-o2-${i}" placeholder="Option 2">
                        <input type="text" id="manual-q-o3-${i}" placeholder="Option 3">
                        <input type="text" id="manual-q-o4-${i}" placeholder="Option 4">
                    </div>
                    <input type="text" id="manual-q-correct-${i}" placeholder="Exact Correct Answer" style="margin-top:10px; border-color:var(--success);">
                </div>
            `;
        } else {
            // Section definition for AI
            renderArea.innerHTML += `
                <div style="margin-bottom: 25px; padding: 20px; background: rgba(0,0,0,0.015); border: 1px dashed var(--border-color); border-radius: 6px;">
                    <h4 style="margin-bottom: 12px; color:var(--primary);">Section ${i} Architecture</h4>
                    <input type="text" id="sec-title-${i}" placeholder="Section Title (e.g. Core Concepts)">
                    <input type="number" id="sec-count-${i}" placeholder="Number of Questions" value="5" min="1">
                </div>
            `;
        }
    }
}

async function generateMultiStepExam() {
    const btn = document.getElementById('gen-multi-btn');
    const status = document.getElementById('gen-multi-status');
    
    let questionsToSave = [];
    
    if (examConfig.mode === 'custom') {
        const total = examConfig.sectionCount;
        for (let i = 1; i <= total; i++) {
            const q = {
                section_title: 'Manual',
                text: document.getElementById(`manual-q-text-${i}`).value.trim(),
                options: [
                    document.getElementById(`manual-q-o1-${i}`).value.trim(),
                    document.getElementById(`manual-q-o2-${i}`).value.trim(),
                    document.getElementById(`manual-q-o3-${i}`).value.trim(),
                    document.getElementById(`manual-q-o4-${i}`).value.trim()
                ],
                correct_answer: document.getElementById(`manual-q-correct-${i}`).value.trim()
            };
            if (!q.text || !q.correct_answer) {
                 alert(`Question ${i} is incomplete.`);
                 return;
            }
            questionsToSave.push(q);
        }
    } else {
        examConfig.sections = [];
        for(let i=1; i<=examConfig.sectionCount; i++) {
            examConfig.sections.push({
                title: document.getElementById(`sec-title-${i}`).value.trim() || `Section ${i}`,
                count: parseInt(document.getElementById(`sec-count-${i}`).value) || 5
            });
        }
    }

    btn.disabled = true;
    status.innerText = examConfig.mode === 'custom' ? "Compiling Custom Protocol..." : (examConfig.mode === 'auto' ? "Processing PDF Context via AI..." : "Compiling Exam Structure...");
    status.style.color = "var(--primary)";

    try {
        if (examConfig.mode !== 'custom') {
            const genRes = await fetch('/api/teacher/generate-questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    keyword: examConfig.subject, 
                    sections: examConfig.sections,
                    difficulty: examConfig.difficulty,
                    type: examConfig.type,
                    pdfContext: examConfig.pdfText
                })
            });
            questionsToSave = await genRes.json();
        }

        status.innerText = "Finalizing Institutional Record...";
        
        const saveRes = await fetch('/api/teacher/exam', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: examConfig.title,
                subject: examConfig.subject,
                difficulty: examConfig.difficulty,
                type: examConfig.type,
                teacherId: currentUser.id,
                duration: examConfig.duration,
                targetClass: examConfig.targetClass,
                questions: questionsToSave
            })
        });

        if (saveRes.ok) {
            status.innerText = "Exam deployed successfully to student roster!";
            status.style.color = "var(--success)";
            
            setTimeout(() => {
                cancelBuilder();
                status.innerText = '';
                btn.disabled = false;
                fetchMyExams();
            }, 3000);
        } else {
             const data = await saveRes.json();
             status.innerText = "Deployment Failed: " + data.error;
             status.style.color = "var(--danger)";
             btn.disabled = false;
        }
    } catch (err) {
        status.innerText = "System Error: " + err.message;
        status.style.color = "var(--danger)";
        btn.disabled = false;
    }
}

function cancelBuilder() {
    document.getElementById('builder-step-2').style.display = 'none';
    document.getElementById('builder-step-1').style.display = 'block';
    
    document.getElementById('exam-title').value = '';
    document.getElementById('exam-subject').value = '';
    document.getElementById('exam-source-file').value = '';
    document.getElementById('upload-status').innerText = '';
    examConfig.pdfText = null;
}
