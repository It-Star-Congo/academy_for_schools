const express = require('express');
const router = express.Router();
const { Exercise, Submission} = require('../models');
const fs = require('fs');
const { spawn, exec  } = require('child_process');
const path = require('path');
const logger = require('../config/logger');


// Récupérer toutes les soumissions
router.get('/', async (req, res) => {
  try {
    const submissions = await Submission.findAll();
    res.json(submissions);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des soumissions' });
  }
});

// Ajouter une soumission
router.post('/', async (req, res) => {
  try {
    const { exercice, data, code, result, score } = req.body;
    const newSubmission = await Submission.create({ exercice, data, code, result, score });
    res.status(201).json(newSubmission);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la création de la soumission' });
  }
});



const sanitizeCodee = (code) => {
    const forbiddenPatterns = [/eval\(/, /exec\(/, /os\./, /import /, /subprocess\./];
    for (let pattern of forbiddenPatterns) {
        if (pattern.test(code)) {
            throw new Error("Code malveillant détecté !");
        }
    }
    return code;
};

router.post('/submite', async (req, res) => {
    try {
        const { code, exerciseId, language, type, answers, response } = req.body;
        const exercise = await Exercise.findByPk(exerciseId);

        if (!exercise) {
            return res.status(404).json({ error: 'Exercice non trouvé' });
        }

        let success = true;
        let score = 0;
        let results = [];
        let sanitizedCode;

        if (type === "programmation") {

            try {
                sanitizedCode = sanitizeCodee(code);
                
            } catch (err) {
                return res.status(400).json({ error: err.message });
            }

            const data = sanitizedCode;

            const fileExtension = { python: 'py', c: 'c', cpp: 'cpp', java: 'java' }[language];
            const fileName = `student_code.${fileExtension}`;
            const filePath = path.join(__dirname, fileName);
            fs.writeFileSync(filePath, generateTemplate(sanitizedCode , language));

            let testCases = typeof exercise.testCases === 'string' ? JSON.parse(exercise.testCases) : exercise.testCases;
            let dockerImage = { python: 'python:3.8', c: 'gcc', cpp: 'gcc', java: 'openjdk' }[language];
            let compileCommand = '', runCommand = '';

            switch (language) {
                case 'python':
                    runCommand = `docker run --rm -v ${filePath}:/app/${fileName} ${dockerImage} python3 /app/${fileName}`;
                    break;
                case 'c':
                    compileCommand = `docker run --rm -v ${filePath}:/app/${fileName} ${dockerImage} gcc /app/${fileName} -o /app/a.out`;
                    runCommand = `docker run --rm -v ${filePath}:/app/${fileName} ${dockerImage} /app/a.out`;
                    break;
                case 'cpp':
                    compileCommand = `docker run --rm -v ${filePath}:/app/${fileName} ${dockerImage} g++ /app/${fileName} -o /app/a.out`;
                    runCommand = `docker run --rm -v ${filePath}:/app/${fileName} ${dockerImage} /app/a.out`;
                    break;
                case 'java':
                    compileCommand = `docker run --rm -v ${filePath}:/app/${fileName} ${dockerImage} javac /app/${fileName}`;
                    runCommand = `docker run --rm -v ${filePath}:/app/${fileName} ${dockerImage} java -cp /app ${fileName.replace('.java', '')}`;
                    break;
            }

            if (compileCommand) {
                await execPromise(compileCommand);
            }

            for (let test of testCases) {
                try {
                    const { stdout } = await execPromise(`${runCommand} ${test.input.join(' ')}`, { timeout: 5000 });
                    let output = stdout.trim();
                    results.push({ input: test.input, output, expected: test.output, success: output === test.output });
                    if (output !== test.output) success = false;
                } catch (err) {
                    return res.json({ success: false, error: err.message });
                }
            }

            fs.unlinkSync(filePath);
            score = success ? 100 : (results.filter(r => r.success).length / testCases.length) * 100;
        } else if (type === "qcm") {
            const data = [];
            console.log("ok on a trer")
            let correctAnswers = 0;
            let totalQuestions = exercise.questions.length;
            exercise.questions.forEach((question, index) => {
                if (answers[`answer-${index}`] == question.correctAnswer) {
                    correctAnswers++;
                }
                // On pousse un objet dans data contenant :
                // - l'énoncé de la question (ici question.text ou comme tu l'as défini)
                // - la réponse donnée par l'utilisateur
                // - la bonne réponse (optionnel)
                // - un flag isCorrect (optionnel)
                data.push({
                    question:      question.text,         // ou question.enonce selon ta structure
                    userAnswer:    answers[`answer-${index}`],
                    correctAnswer: question.correctAnswer,
                    isCorrect:     isCorrect
                });
                console.log(answers[`answer-${index}`]);
                console.log(question.correctAnswer);
            });
            score = (correctAnswers / totalQuestions) * 100;
            success = score === 100;
            results.push({ success: success, message : `Votre test a passé ${correctAnswers} / ${totalQuestions} test(s) !`});
        } else if (type === "redaction") {
            score = Math.floor(Math.random() * 100); // Simulation d'une correction
            success = score >= 50;
        }

        await Submission.create({
            code: data || null,
            result: JSON.stringify(results),
            score,
            UserId: req.session.user.id,
            ExerciseId: exerciseId
        });

        return res.json({ success, score, results });

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});






router.post('/submit', async (req, res) => {
    try {
        const { code, exerciseId, type, answers, response } = req.body;
        const exercise = await Exercise.findByPk(exerciseId);
        

        if (!exercise) {
            return res.status(404).json({ error: 'Exercice non trouvé' });
        }
        console.log(type);

        let success = false;
        let score = 0;
        let results = [];
        let sanitize = null;
        let data = [];

        if (type === "programmation") {

            let langage = "python";


            if (langage == "python"){

                // Sécurisation du code
            const sanitizeCode = (code) => {
                const forbiddenPatterns = [/eval\(/, /exec\(/, /os\./, /import /, /subprocess\./];
                for (let pattern of forbiddenPatterns) {
                    if (pattern.test(code)) {
                        throw new Error("Code malveillant détecté !");
                    }
                }
                return code;
            };

            let sanitizedCode;
            try {
                sanitizedCode = sanitizeCode(code);
                console.log(sanitizedCode);
            } catch (err) {
                return res.status(400).json({ error: err.message });
            }
            sanitizedCode;

            const filePath = path.join(__dirname, 'temp.py');
            const functionTemplate = `
import sys

def user_function(param0):
${sanitizedCode.split('\n').map(line => `    ${line}`).join('\n')}

if __name__ == "__main__":
    args = sys.argv[1:]
    converted_args = [int(arg) if arg.isdigit() else arg for arg in args]
    result = user_function(*converted_args)
    print(result)
            `;
            fs.writeFileSync(filePath, functionTemplate);

            let testCases = typeof exercise.testCases === 'string' ? JSON.parse(exercise.testCases) : exercise.testCases;
            success = true;

            for (let test of testCases) {
                let inputStr = Array.isArray(test.input) ? test.input.join("\n") : test.input;
                let expectedOut = test.output;
                let command = `python3 "${filePath}" ${inputStr}`;

                try {
                    const { stdout } = await execPromise(command, { timeout: 5000 });
                    let output = stdout.trim();
                    console.log('Output:', output);
                    console.log("le resultat est la")

                    if (output === expectedOut) {
                        results.push({ input: test.input, output, expected: expectedOut, success: true });
                    } else {
                        results.push({ input: test.input, output, expected: expectedOut, success: false });
                        success = false;
                    }
                } catch (err) {
                    return res.json({ success: false, error: err.message });
                }
            }

            fs.unlinkSync(filePath);
            score = success ? 100 : (results.filter(r => r.success).length / testCases.length) * 100;
            }

            
        } else if (type === "qcm") {
            
            console.log("ok on a trer")
    
            let correctAnswers = 0;
            let totalQuestions = exercise.questions.length;
            exercise.questions.forEach((question, index) => {
                let isCorrect = false;
                if (answers[`answer-${index}`] == question.correctAnswer) {
                    correctAnswers++;
                    isCorrect = true;
                }
                // On pousse un objet dans data contenant :
                // - l'énoncé de la question (ici question.text ou comme tu l'as défini)
                // - la réponse donnée par l'utilisateur
                // - la bonne réponse (optionnel)
                // - un flag isCorrect (optionnel)
                data.push({
                    question:      question.question,         // ou question.enonce selon ta structure
                    userAnswer:    answers[`answer-${index}`],
                    correctAnswer: question.correctAnswer,
                    isCorrect:     isCorrect
                });
                console.log(answers[`answer-${index}`]);
                console.log(question.correctAnswer);
            });
            score = (correctAnswers / totalQuestions) * 100;
            success = score === 100;
            results.push({ success: success, message : `Votre test a passé ${correctAnswers} / ${totalQuestions} test(s) !`});
        } else if (type === "redaction") {
            score = Math.floor(Math.random() * 100); // Simulation d'une correction
            success = score >= 50;
        }

        await Submission.create({
            code: code || null,
            data: data || null,
            result: JSON.stringify(results),
            score,
            UserId: req.session.user.id,
            ExerciseId: exerciseId
        });

        logger.log({
                level:   'info',
                message: `User ${req.session.user.id} a soumis l'exercice ${exerciseId}`,
                meta: {
                  category: 'interaction',
                  ip:       req.ip,
                  method:   req.method,
                  url:      req.originalUrl
                }
              });

        res.json({ success, score, results });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erreur lors de la soumission de l'exercice" });
    }
});


const generateTemplate = (code, language) => {
    switch (language) {
        case 'python':
            return `import sys\n\ndef user_function(*args):\n${code.split('\n').map(line => `    ${line}`).join('\n')}\n\nif __name__ == "__main__":\n    args = sys.argv[1:]\n    converted_args = [int(arg) if arg.isdigit() else arg for arg in args] if args else []\n    result = user_function(*converted_args)\n    print(result)`;
        case 'c':
            return `#include <stdio.h>\n#include <stdlib.h>\n\n${code}\n\nint main(int argc, char *argv[]) {\n    int param = atoi(argv[1]); \n    printf("%d\n", user_function(param));\n    return 0;\n}`;
        case 'cpp':
            return `#include <iostream>\nusing namespace std;\n\n${code}\n\nint main(int argc, char *argv[]) {\n    int param; cin >> param;\n    cout << user_function(param) << endl;\n    return 0;\n}`;
        case 'java':
            return `public class StudentCode {\n    public static int userFunction(int param) {\n${code.split('\n').map(line => `        ${line}`).join('\n')}\n    }\n    public static void main(String[] args) {\n        int param = Integer.parseInt(args[0]);\n        System.out.println(userFunction(param));\n    }\n}`;
        default:
            throw new Error('Langage non supporté');
    }
};

router.post('/submit3', async (req, res) => {
    try {
        const { code, exerciseId, language } = req.body;
        const exercise = await Exercise.findByPk(exerciseId);
        if (!exercise) return res.status(404).json({ error: 'Exercice non trouvé' });

        const forbiddenPatterns = [/eval\(/, /exec\(/, /os\./, /subprocess\./, /import /];
        for (let pattern of forbiddenPatterns) {
            if (pattern.test(code)) {
                return res.status(400).json({ error: "Code malveillant détecté !" });
            }
        }

        const fileName = `temp.${language === 'python' ? 'py' : language === 'java' ? 'java' : language}`;
        const filePath = path.join(__dirname, fileName);
        fs.writeFileSync(filePath, generateTemplate(code, language));

        let compileCmd = '';
        let runCmd = `docker run --rm -v "${filePath}:/app/${fileName}" my_sandbox `;

        if (language === 'c') {
            compileCmd = `gcc /app/${fileName} -o /app/a.out`; runCmd += `/app/a.out`;
        } else if (language === 'cpp') {
            compileCmd = `g++ /app/${fileName} -o /app/a.out`; runCmd += `/app/a.out`;
        } else if (language === 'java') {
            compileCmd = `javac /app/${fileName}`; runCmd += `java StudentCode`;
        } else if (language === 'python') {
            runCmd += `python3 /app/${fileName}`;
        }

        if (compileCmd) await execPromise(`docker run --rm -v "${filePath}:/app/${fileName}" my_sandbox ${compileCmd}`);
        
        let testCases = typeof exercise.testCases === 'string' ? JSON.parse(exercise.testCases) : exercise.testCases;
        let results = [];
        let success = true;

        for (let test of testCases) {
            let inputStr = Array.isArray(test.input) ? test.input.join(" ") : test.input;
            try {
                const { stdout } = await execPromise(`${runCmd} ${inputStr}`, { timeout: 5000 });
                let output = stdout.trim();
                results.push({ input: test.input, output, expected: test.output, success: output === test.output });
                if (output !== test.output) success = false;
            } catch (err) {
                return res.json({ success: false, error: err.message });
            }
        }

        fs.unlinkSync(filePath);
        let score = success ? 100 : (results.filter(r => r.success).length / testCases.length) * 100;
        res.json({ success, score, results });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// Option : Exécution via Judge0 API (SÉCURISÉE)
router.post("/submit-judge", async (req, res) => {
    try {
        const { code, exerciseId, type} = req.body;
        const exercise = await Exercise.findByPk(exerciseId);
        if (!exercise) return res.status(404).json({ error: 'Exercice non trouvé' });

        console.log(type);

        let success = false;
        let score = 0;
        let results = [];

        let language = "python";

        const forbiddenPatterns = [/eval\(/, /exec\(/, /os\./, /subprocess\./, /import /];
        for (let pattern of forbiddenPatterns) {
            if (pattern.test(code)) {
                return res.status(400).json({ error: "Code malveillant détecté !" });
            }
        }

        let testCases = typeof exercise.testCases === 'string' ? JSON.parse(exercise.testCases) : exercise.testCases;

        const langMap = { python: 71, c: 50, cpp: 54, java: 62 };
        const langId = langMap[language];
        if (!langId) return res.status(400).json({ error: "Langage non supporté" });

        code = generateTemplate(code, language);


        for (let test of testCases) {
            let inputStr = Array.isArray(test.input) ? test.input.join("\n") : test.input;
            let expected = test.output;

            const submissionResponse = await axios.post("https://judge0-ce.p.rapidapi.com/submissions", {
                source_code: code,
                language_id: langId,
                stdin: '',
            }, {
                headers: {
                    "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
                    "X-RapidAPI-Key": "400fe6b8dfmsh090ba2c15e6d470p114edejsn0275637e364a" // Remplace par ta clé API gratuite sur RapidAPI
                },
                params: {
                    base64_encoded: 'true',
                    wait: 'false',
                    fields: '*'
                }
            });
            
            const submissionToken = submissionResponse.data.token;
            
            // Vérifier le résultat après soumission
            let result;
            while (true) {
                const resultResponse = await axios.get(`https://judge0-ce.p.rapidapi.com/submissions/${submissionToken}`, {
                    headers: {
                        "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
                        "X-RapidAPI-Key": "400fe6b8dfmsh090ba2c15e6d470p114edejsn0275637e364a"
                    }
                });
                result = resultResponse.data;
                if (result.status.id >= 3) break; // 3 = terminé avec succès ou erreur
                let output = result.stdout || result.stderr || result.compile_output || "Erreur inconnue"
                console.log(output);
                results.push({ input: test.input, output, expected: test.output, success: output === expected });
                if (output !== expected ) success = false;
                await new Promise(resolve => setTimeout(resolve, 1000)); // Attendre 1 sec
            }
            

        }

        score = success ? 100 : (results.filter(r => r.success).length / testCases.length) * 100;
        res.json({ success, score, results });
        
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});






module.exports = router;




// Fonction utilitaire pour exécuter le code en promesse
const util = require('util');
const execPromise = util.promisify(require('child_process').exec);


module.exports = router;


