document.addEventListener('DOMContentLoaded', function () {
    // Inicialização das Tabs e dos Selects do Materialize CSS
    M.Tabs.init(document.querySelectorAll('.tabs'));
    let selectElements = document.querySelectorAll('select');
    M.FormSelect.init(selectElements);

    const logs = [];

    // Função de registro no histórico (Aba LOG)
    function registrarLog(tipo, termo, statusSucesso) {
        const dataHora = new Date().toLocaleTimeString('pt-BR');
        const statusText = statusSucesso ? 'Sucesso' : 'Falha/Não encontrado';
        const logItem = `[${dataHora}] Busca por ${tipo}: "${termo}" - Status: ${statusText}`;
        
        logs.unshift(logItem);
        
        const listaLogs = document.getElementById('lista-logs');
        listaLogs.innerHTML = logs.map(item => `<li class="collection-item">${item}</li>`).join('');
    }

    // =========================================================================
    // 1. LÓGICA DE BUSCA POR CEP (ViaCEP)
    // =========================================================================
    const inputCep = document.getElementById('cep');
    const btnCep = document.getElementById('btn-cep');
    const divResultadoCep = document.getElementById('resultado-cep');

    async function buscarPorCep() {
        const cepVal = inputCep.value.replace(/\D/g, '');
        
        if (cepVal.length !== 8) {
            M.toast({ html: 'Informe um CEP válido com 8 dígitos.' });
            return;
        }

        divResultadoCep.innerHTML = '<p class="grey-text">Buscando CEP...</p>';

        try {
            const response = await fetch(`https://viacep.com.br/ws/${cepVal}/json/`);
            const data = await response.json();

            if (data.erro) {
                divResultadoCep.innerHTML = '<p class="red-text">CEP não encontrado na base do ViaCEP.</p>';
                registrarLog('CEP', cepVal, false);
                return;
            }

            divResultadoCep.innerHTML = `
                <div class="card-panel card-bordo">
                    <h5>${data.logradouro || 'Logradouro não informado'}</h5>
                    <p><strong>Bairro:</strong> ${data.bairro || '-'}</p>
                    <p><strong>Cidade/UF:</strong> ${data.localidade} / ${data.uf}</p>
                    <p><strong>CEP:</strong> ${data.cep}</p>
                </div>
            `;
            registrarLog('CEP', cepVal, true);
        } catch (error) {
            divResultadoCep.innerHTML = '<p class="red-text">Erro ao realizar a requisição no serviço ViaCEP.</p>';
            registrarLog('CEP', cepVal, false);
        }
    }

    // Disparadores da busca por CEP: clique no botão e evento blur ao sair do input
    btnCep.addEventListener('click', buscarPorCep);
    inputCep.addEventListener('blur', function () {
        if (inputCep.value.trim() !== '') {
            buscarPorCep();
        }
    });

    // =========================================================================
    // 2. LÓGICA DE BUSCA POR RUA (IBGE Localidades + ViaCEP)
    // =========================================================================
    const selectUf = document.getElementById('select-uf');
    const selectCidade = document.getElementById('select-cidade');
    const inputRua = document.getElementById('input-rua');
    const btnRua = document.getElementById('btn-rua');
    const divResultadoRua = document.getElementById('resultado-rua');

    // Carregar UFs via API do IBGE
    async function carregarUFs() {
        try {
            const response = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome');
            const ufs = await response.json();

            selectUf.innerHTML = '<option value="" disabled selected>Selecione a UF</option>';
            ufs.forEach(uf => {
                selectUf.innerHTML += `<option value="${uf.sigla}">${uf.nome} (${uf.sigla})</option>`;
            });
            M.FormSelect.init(selectUf);
        } catch (error) {
            console.error('Erro ao carregar os estados do IBGE:', error);
        }
    }

    // Carregar Cidades do Estado Selecionado via API do IBGE
    selectUf.addEventListener('change', async function () {
        const ufSigla = this.value;
        selectCidade.innerHTML = '<option value="" disabled selected>Carregando cidades...</option>';
        selectCidade.disabled = true;
        M.FormSelect.init(selectCidade);

        try {
            const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${ufSigla}/municipios`);
            const cidades = await response.json();

            selectCidade.innerHTML = '<option value="" disabled selected>Selecione a Cidade</option>';
            cidades.forEach(cidade => {
                selectCidade.innerHTML += `<option value="${cidade.nome}">${cidade.nome}</option>`;
            });
            selectCidade.disabled = false;
            M.FormSelect.init(selectCidade);
        } catch (error) {
            console.error('Erro ao carregar as cidades do IBGE:', error);
        }
    });

    // Buscar lista de logradouros via ViaCEP
    async function buscarPorRua() {
        const uf = selectUf.value;
        const cidade = selectCidade.value;
        const rua = inputRua.value.trim();

        if (!uf || !cidade || rua.length < 3) {
            M.toast({ html: 'Selecione UF, Cidade e digite ao menos 3 letras da rua.' });
            return;
        }

        divResultadoRua.innerHTML = '<p class="grey-text">Buscando logradouros...</p>';

        try {
            const url = `https://viacep.com.br/ws/${uf}/${encodeURIComponent(cidade)}/${encodeURIComponent(rua)}/json/`;
            const response = await fetch(url);
            const listaEnderecos = await response.json();

            if (!Array.isArray(listaEnderecos) || listaEnderecos.length === 0) {
                divResultadoRua.innerHTML = '<p class="red-text">Nenhum endereço foi encontrado.</p>';
                registrarLog('Rua', `${rua}, ${cidade}-${uf}`, false);
                return;
            }

            let htmlCards = '<div class="collection">';
            listaEnderecos.forEach(end => {
                htmlCards += `
                    <div class="collection-item">
                        <span class="title"><strong>${end.logradouro}</strong> (${end.cep})</span>
                        <p>${end.bairro} - ${end.localidade}/${end.uf}</p>
                    </div>
                `;
            });
            htmlCards += '</div>';

            divResultadoRua.innerHTML = htmlCards;
            registrarLog('Rua', `${rua}, ${cidade}-${uf}`, true);
        } catch (error) {
            divResultadoRua.innerHTML = '<p class="red-text">Erro ao realizar busca por rua no ViaCEP.</p>';
            registrarLog('Rua', `${rua}, ${cidade}-${uf}`, false);
        }
    }

    btnRua.addEventListener('click', buscarPorRua);

    // Inicialização da lista de UFs ao carregar a página
    carregarUFs();
});

// =========================================================================
// 3. REGISTRO DO SERVICE WORKER (SUPORTE PWA)
// =========================================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker registrado com sucesso:', reg.scope))
            .catch(err => console.error('Falha ao registrar Service Worker:', err));
    });
}