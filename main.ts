/*******************************
 * Enums básicos
 *******************************/

// Direções principais do robô (para blocos básicos e táticos)
enum DirecaoBase {
    //% block="para frente"
    Frente = 0,
    //% block="para trás"
    Tras = 1,
    //% block="virar para a esquerda"
    GirarEsquerda = 2,
    //% block="virar para a direita"
    GirarDireita = 3
}

// Lado dos LEDs RGB
enum LadoRGB {
    Esquerdo = 0,
    Direito = 1,
    Ambos = 2
}

// Cores possíveis dos LEDs RGB
enum CorRGB {
    Vermelho = 0,
    Verde = 1,
    Azul = 2,
    Branco = 3,
    Apagado = 4
}

// Equipe / cor do time (para feedback visual)
enum TimeLED {
    Azul = 0,
    Vermelho = 1,
    Verde = 2
}

// Lado para girar em blocos táticos
enum LADOVIRAR {
    Esquerda = 0,
    Direita = 1
}


//% color="#ff0000" icon="\uf140" weight=200
//% groups="['Movimento tático', 'Sensores', 'Feedback', 'Avançado']"
namespace RoboBatalha {

    /*******************************
     * Constantes e baixo nível (PCA9685)
     *******************************/
    const PCA9685_ADDRESS = 0x47
    const MODE1 = 0x00
    const PRESCALE = 0xFE
    const LED0_ON_L = 0x06

    let PCA9685_Initialized = false

    function i2cRead(addr: number, reg: number) {
        pins.i2cWriteNumber(addr, reg, NumberFormat.UInt8BE)
        let val = pins.i2cReadNumber(addr, NumberFormat.UInt8BE)
        return val
    }

    function i2cWrite(address: number, reg: number, value: number) {
        let buf = pins.createBuffer(2)
        buf[0] = reg
        buf[1] = value
        pins.i2cWriteBuffer(address, buf)
    }

    function setFreq(freq: number): void {
        let prescaleval = 25000000
        prescaleval /= 4096
        prescaleval /= freq
        prescaleval -= 1
        let prescale = prescaleval
        let oldmode = i2cRead(PCA9685_ADDRESS, MODE1)
        let newmode = (oldmode & 0x7F) | 0x10 // sleep
        i2cWrite(PCA9685_ADDRESS, MODE1, newmode)
        i2cWrite(PCA9685_ADDRESS, PRESCALE, prescale)
        i2cWrite(PCA9685_ADDRESS, MODE1, oldmode)
        control.waitMicros(5000)
        i2cWrite(PCA9685_ADDRESS, MODE1, oldmode | 0xa1)
    }

    function setPwm(channel: number, on: number, off: number): void {
        let buf = pins.createBuffer(5)
        buf[0] = LED0_ON_L + 4 * channel
        buf[1] = on & 0xff
        buf[2] = (on >> 8) & 0xff
        buf[3] = off & 0xff
        buf[4] = (off >> 8) & 0xff
        pins.i2cWriteBuffer(PCA9685_ADDRESS, buf)
    }

    function initPCA9685(): void {
        i2cWrite(PCA9685_ADDRESS, MODE1, 0x00)
        setFreq(50)
        for (let idx = 0; idx < 16; idx++) {
            setPwm(idx, 0, 0)
        }
        PCA9685_Initialized = true
    }

    function ensureInit() {
        if (!PCA9685_Initialized) {
            initPCA9685()
        }
    }

    let brilhoRGB = 4095

    /*******************************
     * Motores – funções internas
     *******************************/
    function pararMotores() {
        // mesma lógica de "stop" da extensão original
        setPwm(0, 0, 4095)
        setPwm(1, 0, 0)
        setPwm(2, 0, 0)

        setPwm(5, 0, 4095)
        setPwm(4, 0, 0)
        setPwm(3, 0, 0)
    }

    function moverBase(direcao: DirecaoBase, velocidade: number, tempoMs: number) {
        ensureInit()
        let speed_value = Math.map(velocidade, 0, 100, 0, 4095)

        switch (direcao) {
            case DirecaoBase.Frente:
                // igual ao "run forward"
                setPwm(0, 0, speed_value)
                setPwm(1, 0, 0)
                setPwm(2, 0, 4095)

                setPwm(5, 0, speed_value)
                setPwm(4, 0, 0)
                setPwm(3, 0, 4095)
                break

            case DirecaoBase.Tras:
                // igual ao "run back"
                setPwm(0, 0, speed_value)
                setPwm(1, 0, 4095)
                setPwm(2, 0, 0)

                setPwm(5, 0, speed_value)
                setPwm(4, 0, 4095)
                setPwm(3, 0, 0)
                break

            case DirecaoBase.GirarEsquerda:
                // igual ao "turn left"
                setPwm(0, 0, speed_value)
                setPwm(1, 0, 4095)
                setPwm(2, 0, 0)

                setPwm(5, 0, speed_value)
                setPwm(4, 0, 0)
                setPwm(3, 0, 4095)
                break

            case DirecaoBase.GirarDireita:
                // igual ao "turn right"
                setPwm(0, 0, speed_value)
                setPwm(1, 0, 0)
                setPwm(2, 0, 4095)

                setPwm(5, 0, speed_value)
                setPwm(4, 0, 4095)
                setPwm(3, 0, 0)
                break
        }

        if (tempoMs > 0) {
            basic.pause(tempoMs)
            pararMotores()
        }
    }

    /*******************************
     * MOVIMENTO TÁTICO + COMANDOS BÁSICOS
     *******************************/

    /**
     * Movimento básico: anda na direção escolhida com a velocidade informada (sem tempo).
     */
    //% block="mover robô $direcao com velocidade $velocidade \\%"
    //% velocidade.min=0 velocidade.max=100
    //% group="Movimento tático" weight=99
    export function moverSimples(direcao: DirecaoBase, velocidade: number) {
        moverBase(direcao, velocidade, 0)
    }

    /**
     * Avançar para frente por um tempo em ms.
     */
    //% block="avançar com velocidade $velocidade \\% por $tempo ms"
    //% velocidade.min=0 velocidade.max=100
    //% group="Movimento tático" weight=95
    export function avancar(velocidade: number, tempo: number) {
        moverBase(DirecaoBase.Frente, velocidade, tempo)
    }

    /**
     * Recuar por um tempo em ms.
     */
    //% block="recuar com velocidade $velocidade \\% por $tempo ms"
    //% velocidade.min=0 velocidade.max=100
    //% group="Movimento tático" weight=94
    export function recuar(velocidade: number, tempo: number) {
        moverBase(DirecaoBase.Tras, velocidade, tempo)
    }

    /**
     * Virar usando ângulo (tempo escondido dos alunos).
     */
    //% block="virar para $lado ângulo $angulo ° com velocidade $velocidade \\%"
    //% angulo.min=0 angulo.max=180
    //% velocidade.min=0 velocidade.max=100
    //% group="Movimento tático" weight=93
    export function virarComAngulo(lado: LADOVIRAR, angulo: number, velocidade: number) {
        // mapeia ângulo para tempo aproximado (ajustável na prática)
        let tempo = Math.map(angulo, 0, 180, 0, 1000)
        if (lado == LADOVIRAR.Esquerda) {
            moverBase(DirecaoBase.GirarEsquerda, velocidade, tempo)
        } else {
            moverBase(DirecaoBase.GirarDireita, velocidade, tempo)
        }
    }

    /**
     * Ataque rápido: avanço curto e veloz.
     */
    //% block="ataque rápido (avançar rápido)"
    //% group="Movimento tático" weight=92
    export function ataqueRapido() {
        moverBase(DirecaoBase.Frente, 100, 300)
    }

    /**
     * Fuga rápida: recuo curto e veloz.
     */
    //% block="fuga rápida (recuar rápido)"
    //% group="Movimento tático" weight=91
    export function fugaRapida() {
        moverBase(DirecaoBase.Tras, 100, 300)
    }

    /**
     * Giro de defesa: gira no lugar para procurar inimigo ou escapar.
     */
    //% block="giro de defesa"
    //% group="Movimento tático" weight=90
    export function giroDeDefesa() {
        moverBase(DirecaoBase.GirarDireita, 80, 600)
    }

    /**
     * Parar imediatamente.
     */
    //% block="parar robô"
    //% group="Movimento tático" weight=89
    export function parar() {
        ensureInit()
        pararMotores()
    }

    /*******************************
     * SENSORES – reutilizando lógica
     * do LineTracking e ultra()
     *******************************/

    let ultimoTempoUltra = 0

    /**
     * Distância medida pelo sensor ultrassônico (em cm).
     */
    //% block="distância até o inimigo (cm)"
    //% group="Sensores" weight=85
    export function distanciaInimigo(): number {
        ensureInit()

        // mesmo código do ultra() original
        pins.setPull(DigitalPin.P1, PinPullMode.PullNone)
        pins.digitalWritePin(DigitalPin.P1, 0)
        control.waitMicros(2)
        pins.digitalWritePin(DigitalPin.P1, 1)
        control.waitMicros(10)
        pins.digitalWritePin(DigitalPin.P1, 0)

        let t = pins.pulseIn(DigitalPin.P2, PulseValue.High, 35000)
        let ret = t

        if (ret == 0 && ultimoTempoUltra != 0) {
            ret = ultimoTempoUltra
        }
        ultimoTempoUltra = t

        return Math.round(ret / 58)
    }

    /**
     * Verdadeiro se o inimigo está mais perto que a distância indicada (cm).
     */
    //% block="inimigo está a menos de $distancia cm"
    //% distancia.min=1 distancia.max=200
    //% group="Sensores" weight=84
    export function inimigoPerto(distancia: number): boolean {
        return distanciaInimigo() <= distancia
    }

    /**
     * Leitura bruta dos três sensores de linha.
     * (0 a 7 – para uso avançado / professor)
     */
    //% block="leitura dos sensores de linha (0 a 7)"
    //% group="Avançado" weight=70
    export function leituraLinha(): number {
        // mesmo cálculo do LineTracking original
        let val = (pins.digitalReadPin(DigitalPin.P14) << 2) +
            (pins.digitalReadPin(DigitalPin.P15) << 1) +
            (pins.digitalReadPin(DigitalPin.P16))
        return val
    }

    /**
     * Verdadeiro se algum sensor enxergar a linha da borda da arena.
     */
    //% block="robô está na borda da arena"
    //% group="Sensores" weight=83
    export function roboNaBorda(): boolean {
        let v = leituraLinha()
        // aqui consideramos "na borda" se ao menos um sensor vê a linha
        return v != 0
    }

    /**
     * Verdadeiro se NÃO estiver na borda (área segura).
     */
    //% block="robô está em área segura (longe da borda)"
    //% group="Sensores" weight=82
    export function roboEmAreaSegura(): boolean {
        return !roboNaBorda()
    }

    /*******************************
     * FEEDBACK VISUAL – LED de time
     *******************************/

    /**
     * Ajustar brilho máximo dos LEDs RGB (0 a 255).
     */
    //% block="definir brilho dos LEDs de time para $brilho"
    //% brilho.min=0 brilho.max=255
    //% group="Feedback" weight=79
    export function definirBrilhoLED(brilho: number) {
        ensureInit()
        brilhoRGB = Math.map(brilho, 0, 255, 0, 4095)
    }

    function setRGB(lado: LadoRGB, cor: CorRGB) {
        ensureInit()

        // limpar todos os canais das duas laterais
        setPwm(9, 0, 0)
        setPwm(10, 0, 0)
        setPwm(11, 0, 0)
        setPwm(6, 0, 0)
        setPwm(7, 0, 0)
        setPwm(8, 0, 0)

        function aplicaLadoEsquerdo(c: CorRGB) {
            if (c == CorRGB.Vermelho || c == CorRGB.Branco) setPwm(9, 0, brilhoRGB)
            if (c == CorRGB.Verde || c == CorRGB.Branco) setPwm(10, 0, brilhoRGB)
            if (c == CorRGB.Azul || c == CorRGB.Branco) setPwm(11, 0, brilhoRGB)
        }

        function aplicaLadoDireito(c: CorRGB) {
            if (c == CorRGB.Vermelho || c == CorRGB.Branco) setPwm(7, 0, brilhoRGB)
            if (c == CorRGB.Verde || c == CorRGB.Branco) setPwm(6, 0, brilhoRGB)
            if (c == CorRGB.Azul || c == CorRGB.Branco) setPwm(8, 0, brilhoRGB)
        }

        if (lado == LadoRGB.Esquerdo || lado == LadoRGB.Ambos) {
            aplicaLadoEsquerdo(cor)
        }
        if (lado == LadoRGB.Direito || lado == LadoRGB.Ambos) {
            aplicaLadoDireito(cor)
        }
    }

    /**
     * Definir cor do time (acende os dois LEDs do robô na mesma cor).
     */
    //% block="definir LED de time como $equipe"
    //% group="Feedback" weight=78
    export function ledDeTime(equipe: TimeLED) {
        let cor = CorRGB.Apagado
        if (equipe == TimeLED.Azul) cor = CorRGB.Azul
        if (equipe == TimeLED.Vermelho) cor = CorRGB.Vermelho
        if (equipe == TimeLED.Verde) cor = CorRGB.Verde

        setRGB(LadoRGB.Ambos, cor)
    }

    /**
     * Apagar LEDs de time.
     */
    //% block="apagar LEDs de time"
    //% group="Feedback" weight=77
    export function apagarLEDTime() {
        setRGB(LadoRGB.Ambos, CorRGB.Apagado)
    }

    /*******************************
     * BLOCOS COMPATÍVEIS COM ultra() E LineTracking()
     * (para você usar nos exemplos em sala)
     *******************************/

    /**
     * Ultrassônico (compatível com o nome ultra).
     */
    //% block="Ultrassônico (cm)"
    //% group="Avançado" weight=60
    export function ultra(): number {
        return distanciaInimigo()
    }

    /**
     * LineTracking (compatível com o antigo Turtle.LineTracking).
     * Retorna 0 a 7.
     */
    //% block="LineTracking (0 a 7)"
    //% group="Avançado" weight=59
    export function LineTracking(): number {
        return leituraLinha()
    }
}
