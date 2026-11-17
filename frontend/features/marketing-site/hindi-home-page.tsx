import Link from "next/link";
import Image from "next/image";

const needs = [
  ["बिक्री की स्पष्ट जानकारी", "पूछताछ, जिम्मेदार व्यक्ति और अगला फ़ॉलो-अप एक जगह देखें।"],
  ["दैनिक काम पर बेहतर नियंत्रण", "प्रोजेक्ट, कार्य और समय-सीमा को टीम की जिम्मेदारियों से जोड़ें।"],
  ["वित्तीय स्थिति समझें", "टीम द्वारा दर्ज आय, खर्च, इनवॉइस और भुगतान देखें।"],
  ["टीम के लिए साझा संदर्भ", "हर व्यक्ति को उसकी भूमिका के अनुसार सेवाओं और रिकॉर्ड तक पहुँच दें।"],
  ["सावधानी से ऑटोमेशन", "स्वीकृति और गतिविधि इतिहास के साथ दोहराए जाने वाले काम संभालें।"],
  ["अगला कदम चुनें", "अनुमत व्यावसायिक डेटा के आधार पर SATHOS से प्राथमिकताएँ पूछें।"],
] as const;

const services = [
  ["ग्राहक", "ग्राहक प्रोफ़ाइल, बातचीत और फ़ॉलो-अप को साथ रखें।"],
  ["लीड्स और बिक्री", "पूछताछ से बिक्री तक जिम्मेदारी और अगले कदम स्पष्ट रखें।"],
  ["प्रोजेक्ट और कार्य", "काम की योजना, जिम्मेदारी और देरी को देखें।"],
  ["वित्त", "आय, खर्च, इनवॉइस और भुगतान का रिकॉर्ड रखें।"],
  ["लोग", "कर्मचारी रिकॉर्ड को लॉगिन और अनुमतियों से अलग रखें।"],
  ["ऑटोमेशन", "स्वीकृत चैनल और लंबित कार्य नियंत्रित ढंग से संभालें।"],
] as const;

export function HindiHomePage() {
  return <>
    <section className="site-hero"><div className="site-hero-copy"><span className="site-kicker">आगे के लिए तैयार</span><h1>अपने व्यवसाय को एक जुड़े हुए कार्यस्थल से चलाएँ।</h1><p>SATHOS लोगों, ग्राहकों, पैसों, काम और व्यावसायिक जानकारी को जोड़ता है, ताकि आपकी टीम बिखरे अपडेट से स्पष्ट कार्रवाई तक पहुँच सके।</p><div className="site-actions"><Link className="site-button" href="/contact">शुरुआती पहुँच का अनुरोध करें</Link><Link className="site-button secondary" href="/how-it-works">जानें यह कैसे काम करता है</Link></div><ul><li>हर संगठन का डेटा अलग</li><li>अनुमतियों के अनुसार पहुँच</li><li>महत्वपूर्ण कार्रवाई पर मानवीय पुष्टि</li></ul></div><div className="site-hero-art" aria-label="SATHOS लोगों, प्रक्रियाओं, AI और विकास को जोड़ता है"><Image src="/brand/sathos-brand-artwork.png" alt="SATHOS का प्रतीक" width={1280} height={1280} priority /></div></section>
    <section className="site-proof" aria-label="SATHOS के सिद्धांत"><span>एक कार्यस्थल</span><span>सत्यापित व्यावसायिक डेटा</span><span>नियंत्रित ऑटोमेशन</span><span>बढ़ती टीमों के लिए</span></section>
    <section className="site-section site-needs"><header><span className="site-kicker">अपनी जरूरत से शुरू करें</span><h2>आप क्या बेहतर करना चाहते हैं?</h2><p>अपनी परिचित व्यावसायिक समस्या चुनें। SATHOS संबंधित रिकॉर्ड, जिम्मेदारियाँ और अगले कदम एक जगह लाता है।</p></header><div>{needs.map(([title, copy]) => <article key={title}><h3>{title}</h3><p>{copy}</p><Link href="/services">SATHOS कैसे मदद करता है →</Link></article>)}</div></section>
    <section className="site-section"><header><span className="site-kicker">SATHOS क्यों</span><h2>कम भागदौड़, अधिक स्पष्टता।</h2><p>व्यवसाय की स्थिति देखें, अगली प्राथमिकता पहचानें और टीम को समझ आने वाली प्रक्रिया से काम करें।</p></header><div className="site-card-grid"><article><h3>ध्यान देने योग्य काम देखें</h3><p>लंबित काम, ग्राहक फ़ॉलो-अप और वित्तीय स्थिति अलग-अलग रिपोर्ट जोड़े बिना देखें।</p></article><article><h3>टीम को एक दिशा दें</h3><p>ग्राहक, बिक्री, प्रोजेक्ट, लोग, वित्त और ऑटोमेशन को अनुमतियों के साथ जोड़ें।</p></article><article><h3>संदर्भ के साथ पूछें</h3><p>अनुमत डेटा के बारे में SATHOS से पूछें और नियंत्रित कार्रवाई की पुष्टि करें।</p></article></div></section>
    <section className="site-section site-services"><header><span className="site-kicker">जुड़ी हुई सेवाएँ</span><h2>आज अपने व्यवसाय के लिए जरूरी सेवाएँ चुनें।</h2><p>आप ग्राहक और वित्त से शुरू कर सकते हैं; उपयुक्त प्रक्रिया बनने पर अन्य सेवाएँ जोड़ सकते हैं।</p></header><div className="site-service-grid">{services.map(([title, copy]) => <article key={title}><h3>{title}</h3><p>{copy}</p><Link href="/services">और जानें →</Link></article>)}</div></section>
    <section className="site-section site-process"><header><span className="site-kicker">व्यावहारिक शुरुआत</span><h2>अपनी मौजूदा कार्यप्रणाली के अनुसार SATHOS अपनाएँ।</h2><p>पहले एक उपयोगी प्रक्रिया चुनें, जिम्मेदारी तय करें और सत्यापित डेटा के आधार पर आगे बढ़ें।</p></header><Link className="site-text-link" href="/how-it-works">पूरी शुरुआत प्रक्रिया पढ़ें →</Link></section>
    <section className="site-cta"><span className="site-kicker">सीमित निजी बीटा</span><h2>व्यवसाय चलाने का अधिक व्यवस्थित तरीका बनाएँ।</h2><p>हमें अपने संगठन, मौजूदा साधनों और सबसे कठिन प्रक्रिया के बारे में बताएँ। हमारी टीम अनुरोध की समीक्षा करेगी; खाता स्वतः स्वीकृत नहीं होगा और अनुरोध करने पर शुल्क नहीं लगेगा।</p><div className="site-actions"><Link className="site-button" href="/contact">SATHOS से बात करें</Link><Link href="/login">पहले से पहुँच है? साइन इन करें →</Link></div></section>
  </>;
}
