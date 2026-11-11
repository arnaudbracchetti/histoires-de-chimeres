# Service d'envoi d'emails

Recherche du ticket [#167](https://github.com/arnaudbracchetti/histoires-de-chimeres/issues/167), sous-ticket de #159. Ce document rassemble des faits et leurs sources. Il ne tranche pas.

**Question** : quel service pour envoyer les liens magiques du back office (ID-6, PRD §6), depuis le conteneur de l'API : SMTP ou API HTTP, et chez qui ? Comment faire en dev, en démo et en tests e2e sans vrai envoi ?

**Volume** : quelques dizaines de comptes MJ et Organisateurs, quelques centaines d'emails par an au plus, avec un pic autour de la convention (quelques dizaines par jour). Seuls des emails transactionnels, jamais de campagne.

Faits relevés le 11 novembre 2026. Chaque fait renvoie à une source numérotée, listée en fin de document. Plusieurs sites de fournisseurs (Brevo, Scaleway) refusent la lecture automatique de leurs pages : leurs chiffres viennent alors de leur documentation publique sur GitHub, de leur centre d'aide, ou d'extraits de leurs pages officielles relevés par un moteur de recherche. C'est signalé au cas par cas.

## Synthèse

- **Au volume visé, tous les candidats sont gratuits ou presque.** Brevo : 300 emails par jour gratuits. Mailjet : 200 par jour et 6 000 par mois. Scaleway : 300 par mois gratuits, puis 0,25 € les 1 000. Postmark : 100 par mois, sans dépassement possible. Amazon SES : 0,10 $ les 1 000, sans offre gratuite propre à SES.
- **Données en UE** : Scaleway (France, région `fr-par` seule, aucun sous-traitant hors UE pour ce service), Brevo (France, Allemagne, Belgique), Mailjet (Allemagne, Belgique). Postmark stocke tout aux États-Unis. SES stocke dans la région AWS choisie (Paris existe), mais AWS est une société américaine.
- **DNS** : chez tous, il faut au moins un enregistrement DKIM et une mise à jour du SPF du domaine d'envoi. Brevo exige aussi un enregistrement DMARC. Gmail exige de tout expéditeur SPF ou DKIM, TLS et un DNS inverse ; DMARC n'est obligatoire qu'au-delà de 5 000 messages par jour, mais reste conseillé.
- **Bibliothèque** : Nodemailer 10 (MIT-0, aucune dépendance, ses propres types TypeScript, Node 20 et plus) parle SMTP à tous les candidats. Il apporte aussi des transports de test (`jsonTransport`, `streamTransport`). Les SDK HTTP des fournisseurs existent, mais lient le code à un seul d'entre eux.
- **SMTP ou API** : par SMTP, changer de fournisseur revient à changer cinq variables d'environnement. Par API, on gagne des erreurs plus précises et on évite les ports SMTP sortants, que certains hébergeurs bloquent.
- **Hors production** : Mailpit (MIT, v1.33.1 du 7 novembre 2026) reçoit le SMTP sur le port 1025, montre les emails sur le port 8025, et offre une API REST qu'un test Playwright peut interroger pour récupérer le lien magique. Agilometre l'utilise déjà avec Nodemailer.

## 1. Point de départ vérifié

- L'API est en NestJS 12 (`apps/api/package.json`), et n'envoie aucun email aujourd'hui. Aucune variable `SMTP_*` n'existe dans `.env.prod.example` ni dans `docker-compose.prod.yml`.
- **Serveur de test** : `test2.nekbet.fr` pointe vers 152.228.233.17, une adresse d'un VPS OVH (réseau `VPS-SBG8`, France) d'après la base RIPE [20]. Le domaine `nekbet.fr` a déjà un service de messagerie chez OVH (MX `mx1.mail.ovh.net`) et un SPF strict `v=spf1 include:mx.ovh.com -all`, sans enregistrement DMARC (requêtes DNS du 11 novembre 2026). Envoyer depuis `@nekbet.fr` par un autre fournisseur imposerait donc d'ajouter ce fournisseur au SPF existant : un domaine ne doit avoir qu'un seul enregistrement SPF. Le domaine de production n'est pas connu à ce jour.
- **Agilometre** (`/home/arnaud/projets/agilometre`) envoie déjà des emails : Nodemailer 9.0.5 derrière un port (`NodemailerMailSender`), variables `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, et Mailpit dans son `docker-compose.yml` (`axllent/mailpit`, ports 1025 et 8025). Son compose lance Mailpit avec `--smtp-disable-rdns`, avec ce commentaire : sans ce drapeau, la résolution DNS inverse prenait environ 8 s par email sous WSL2.

## 2. Les candidats

### Brevo (ex-Sendinblue, société française)

- **Gratuit** : 300 emails par jour, sans expiration, marketing et transactionnel confondus. L'API transactionnelle et le relais SMTP sont inclus dans l'offre gratuite. Un nouveau compte doit être validé avant d'envoyer. Au-delà, il faut passer à l'offre Starter, qui n'a plus de limite quotidienne [1]. *Source* : pages officielles de Brevo (centre d'aide, page « Free SMTP server », page « Email API »), lues par extraits de moteur de recherche, le site refusant la lecture directe. Je n'ai pas pu vérifier sur une source primaire si le logo Brevo s'ajoute aux emails transactionnels de l'offre gratuite.
- **Débit** : l'endpoint `POST /v3/smtp/email` accepte 1 000 requêtes par seconde, sur toutes les offres, gratuite comprise [2].
- **SMTP** : `smtp-relay.brevo.com`, port 587 en STARTTLS. Identifiant : l'adresse de connexion ou une adresse `[ID]@smtp-brevo.com`. Mot de passe : une clé SMTP [3].
- **DNS** : trois enregistrements pour authentifier le domaine : un code Brevo (TXT), un DKIM (un TXT ou deux CNAME) et un DMARC (TXT). Brevo conseille `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com`, ou d'ajouter son adresse `rua` à un DMARC existant. La vérification peut prendre jusqu'à 48 heures [3].
- **Données** : serveurs en UE, chez OVH (France, Allemagne) et Google Cloud (Belgique). L'annexe des sous-traitants du DPA cite aussi des sociétés du groupe hors UE (États-Unis, Inde, Canada) qui ont un accès aux données [4].

### Scaleway Transactional Email (TEM, société française)

- **Prix** : offre Essential, sans abonnement, 300 emails gratuits par mois et par organisation, puis 0,25 € les 1 000. L'offre Scale coûte 80 € par mois pour 100 000 emails, avec une IP dédiée, puis 0,20 € les 1 000 [5][6]. La facturation compte les emails envoyés au-delà du gratuit : 305 emails, 5 facturés [5]. Chaque destinataire compte pour un email (un `To` et trois `Cc` font 4) [7]. *Source* : documentation de Scaleway sur GitHub ; le prix de 0,25 € vient d'un extrait de la page tarifaire officielle, que le site refuse à la lecture directe.
- **Usage** : transactionnel seulement, le marketing est interdit [5]. Quota par défaut : 10 000 emails par mois, 10 destinataires par email, 2 Mo par email en API, 50 Mo en SMTP. Plus de quota horaire depuis le 1er décembre 2023. Les nouveaux comptes peuvent avoir des limites plus strictes au début [7].
- **SMTP** : `smtp.tem.scaleway.com`, ports 587 (STARTTLS), 465 (SSL) ou 2465 (TLS). Identifiant : l'identifiant du projet Scaleway. Mot de passe : un jeton d'API avec les droits Transactional Email [8]. Une API HTTP existe aussi [5].
- **DNS** : SPF et DKIM obligatoires, puis vérification du domaine. MX « fortement recommandé » ; Scaleway fournit un MX « trou noir » si le domaine n'en a pas [5]. L'`include` SPF récursif n'est pas pris en charge [7]. La configuration DNS peut être automatique si le domaine est géré chez Scaleway [5].
- **Données** : service disponible dans la seule région `fr-par`. « No personal data is transferred outside the EU » ; toute la pile technique est gérée par Scaleway, en UE, sans sous-traitant hors UE [5][7].
- **Délai** : sur une IP neuve ou une réputation faible, l'envoi peut prendre plusieurs minutes, le volume étant accordé progressivement [5]. Un lien magique qui arrive avec plusieurs minutes de retard gênerait l'Organisateur ; ce point n'est pas chiffré par Scaleway.
- **SLA** : réservé à l'offre Scale [9].

### Mailjet (Sinch, société suédoise)

- **Gratuit** : 6 000 emails par mois, au plus 200 par jour. API, relais SMTP et webhooks inclus. Offre Starter : 9 $ par mois pour 8 000 emails. La mention « sans logo Mailjet » n'apparaît qu'à partir de l'offre Essential, ce qui laisse penser que l'offre gratuite ajoute le logo [10].
- **Données** : centres de données exclusivement en UE, Google Cloud à Francfort (Allemagne) et Saint-Ghislain (Belgique) [11].

### Postmark (ActiveCampaign, société américaine)

- **Gratuit** : 100 emails par mois, « No overages allowed in this plan ». Offre Basic : 15 $ par mois pour 10 000 emails, puis 1,80 $ les 1 000 [12].
- **Validation** : chaque nouveau compte est revu à la main. En attendant, on ne peut écrire qu'aux adresses des domaines vérifiés du compte. La revue prend moins de 24 heures en semaine [13].
- **Données** : serveurs aux États-Unis (près de Chicago, et AWS), sans projet de serveurs en UE. Le transfert repose sur un DPA et les clauses contractuelles types. Rétention par défaut des contenus et métadonnées : 45 jours [14].
- Postmark est réputé pour sa délivrabilité transactionnelle, mais je n'ai trouvé aucune mesure indépendante et primaire qui compare les candidats entre eux.

### Amazon SES

- **Prix** : 0,10 $ les 1 000 emails à la carte. Pas d'offre gratuite propre à SES : un nouveau compte AWS reçoit jusqu'à 200 $ de crédits, utilisables 6 mois sur l'offre gratuite [15].
- **Sandbox** : un nouveau compte ne peut écrire qu'à des adresses vérifiées, au plus 200 messages par 24 heures. Il faut demander l'accès en production [16].
- **Données** : stockées dans la région choisie (`eu-west-3` est à Paris), mais AWS est une société américaine. Créer et administrer un compte AWS (IAM, région, facturation) demande plus de travail que les autres candidats pour une association.
- Nodemailer a un transport SES natif [17].

### SMTP de l'hébergeur ou d'une messagerie (exemple : OVH MX Plan)

- **OVH** : `smtp.mail.ovh.net`, port 465 (SSL/TLS, conseillé) ou 587 (STARTTLS). Quotas : environ 200 emails par heure par adresse, et 300 par heure par IP source. L'authentification se fait par l'adresse complète et son mot de passe. Guide mis à jour le 3 septembre 2026 [18].
- **Avantage** : si l'association a déjà une adresse chez OVH sur son domaine, le SPF et le DKIM sont ceux d'OVH, sans nouveau fournisseur ni nouveau contrat. `nekbet.fr` est déjà dans ce cas (§1).
- **Limites** : le mot de passe d'une vraie boîte aux lettres vit dans la configuration du conteneur. Il n'y a ni webhook de rejet, ni journal d'envoi, ni API.
- **Ports sortants d'un VPS** : je n'ai trouvé aucune page officielle d'OVH sur le blocage des ports SMTP sortants des VPS. Des fils de la communauté OVH signalent des délais de connexion sur 465 ou 587 vers `ssl0.ovh.net` depuis certains VPS [19]. Scaleway, pour comparaison, ferme par défaut les ports 587, 465 et 2465 de ses propres instances [8]. Un test depuis le serveur réglerait la question.

## 3. Délivrabilité et DNS

Exigences de Gmail, en vigueur depuis le 1er février 2024 [21] :

| | Tous les expéditeurs | Plus de 5 000 messages par jour |
|---|---|---|
| Authentification | SPF **ou** DKIM | SPF **et** DKIM |
| DMARC | non exigé | exigé (`p=none` suffit) |
| Alignement du `From:` | non exigé | sur le domaine SPF ou DKIM |
| Autres | DNS inverse valide, TLS, RFC 5322, taux de plainte < 0,3 % | idem |

Conséquences :

- Notre volume reste loin du seuil de 5 000. Le minimum exigé par Gmail est donc un DKIM ou un SPF. Brevo exige pourtant DMARC pour authentifier un domaine [3].
- Avec un fournisseur, le DKIM signe au nom de notre domaine : c'est ce qui aligne le `From:` et fait passer DMARC, même si le SPF ne passe que pour le domaine de rebond du fournisseur.
- Le DNS inverse et TLS sont à la charge du fournisseur dès qu'on passe par un relais. Envoyer directement depuis le VPS (serveur SMTP dans le conteneur, port 25) obligerait à les gérer nous-mêmes ; aucun des candidats ne le demande.
- **Suivi des clics** : certains fournisseurs réécrivent les liens pour compter les clics. Le lien magique passerait alors par leur redirecteur. Chez Postmark, le suivi des liens n'existe qu'après validation du compte [13]. Les réglages par défaut des autres n'ont pas été vérifiés : à désactiver pour ces emails.

## 4. RGPD

- Les emails des MJ et des Organisateurs sont des données personnelles (PRD §6). Le fournisseur agit en sous-traitant : il faut un DPA. Brevo [4], Scaleway [5], Postmark [14] en proposent un ; Mailjet aussi d'après ses pages [11].
- **Transfert hors UE** : aucun chez Scaleway pour ce service [5]. Possible accès depuis des sociétés du groupe hors UE chez Brevo [4]. Systématique chez Postmark, sous clauses contractuelles types [14].
- Le contenu d'un email de lien magique est minimal : une adresse, un lien, un nom de convention. La rétention de 45 jours de Postmark [14] conserverait des liens déjà expirés.

## 5. Bibliothèques Node

| Paquet | Version (date) | Licence | Dépendances | Téléchargements par semaine |
|---|---|---|---:|---:|
| `nodemailer` | 10.5.0 (10/11/2026) | MIT-0 | 0 | 37 millions |
| `@getbrevo/brevo` | 6.2.0 (16/10/2026) | non déclarée | 0 | 450 000 |
| `postmark` | 5.1.1 (10/11/2026) | MIT | 0 | 1,7 million |
| `node-mailjet` | 6.0.11 (27/10/2025) | MIT | 3 | 257 000 |
| `@scaleway/sdk-tem` | 2.17.0 (02/11/2026) | Apache-2.0 | 2 | 21 000 |
| `@aws-sdk/client-sesv2` | 3.1166.0 (10/11/2026) | Apache-2.0 | 9 | 9 millions |

Source : registre npm et API de téléchargements npm, semaine précédant le 11 novembre 2026 [22].

- **Nodemailer 10** exige Node 20 ou plus (le projet est en Node 22). Il n'a aucune dépendance d'exécution et publie ses types (`dist/cjs/nodemailer.d.ts`) : `@types/nodemailer` n'est plus nécessaire. Transports : SMTP par défaut, SES, sendmail, `streamTransport` et `jsonTransport` (le message est produit sans être envoyé, pour les tests) [17][22].
- Par SMTP, un même code Nodemailer sert Brevo, Scaleway, Mailjet, Postmark, SES et OVH. Seules changent les variables de connexion.
- `@nestjs-modules/mailer`, souvent cité pour NestJS, n'a pas été évalué : un port de `application` implémenté par une classe Nodemailer suffit, comme pour `NotificationSender` (ADR 0010) et comme dans Agilometre.

## 6. Dev, démo et tests e2e sans vrai envoi

**Mailpit** (`axllent/mailpit`, MIT, v1.33.1 du 7 novembre 2026, dépôt actif) [23] :

- reçoit le SMTP sur le port 1025, sans authentification, et affiche les emails dans une interface web sur le port 8025 [24] ;
- offre une API REST : `GET /api/v1/message/latest` (le dernier email), `GET /api/v1/search?query=to:"…"` (par destinataire), `DELETE /api/v1/messages` (tout effacer), `GET /view/{ID}.txt` (le texte d'un email) [25][26] ;
- se borne en taille par `--max` (nombre d'emails) ou `--max-age` [24].

Usages possibles :

- **Dev** : un service `mailpit` dans `docker-compose.yml`, lancé avec `pnpm dev:db` comme dans Agilometre. L'API pointe vers `localhost:1025`.
- **Tests e2e Playwright** : le conteneur `app-e2e` envoie à Mailpit. Le test cherche l'email par destinataire, en extrait le lien et l'ouvre. Ce parcours couvre le vrai câblage SMTP. Les tests du bureau remettent la base à zéro : il faudrait aussi vider Mailpit, ou chercher par une adresse propre à chaque test.
- **Suite HTTP de l'API** (`test:e2e`, sans port bouchonné) : soit Mailpit aussi, soit `jsonTransport` de Nodemailer, qui produit le message sans réseau. La seconde voie ne vérifie pas la connexion SMTP.
- **Démo et serveur de test** (`test2.nekbet.fr`) : trois voies. Un vrai fournisseur, avec de vraies adresses. Un Mailpit sur le serveur, son interface publiée derrière Caddy avec une authentification. Ou un mode où l'API écrit le lien dans ses journaux au lieu de l'envoyer. Les deux dernières évitent d'envoyer des emails à des adresses fictives, ce qui nuirait à la réputation du domaine (rejets).
- **Ethereal** : Nodemailer propose aussi des comptes de test Ethereal, un service en ligne qui capte les emails [17]. Il exige une connexion internet, à la différence de Mailpit.

## 7. Tableau comparatif

| | Brevo | Scaleway TEM | Mailjet | Postmark | Amazon SES | SMTP OVH |
|---|---|---|---|---|---|---|
| Gratuit | 300/jour | 300/mois | 200/jour, 6 000/mois | 100/mois, plafond dur | non (crédits AWS) | inclus dans l'offre de messagerie |
| Au-delà | offre Starter | 0,25 € / 1 000 | 9 $/mois | 15 $/mois | 0,10 $ / 1 000 | — |
| Données | UE (accès hors UE possible) | UE seule | UE | États-Unis | région choisie | France |
| Société | France | France | Suède | États-Unis | États-Unis | France |
| DNS à ajouter | code, DKIM, DMARC | SPF, DKIM (MX conseillé) | SPF, DKIM | DKIM, Return-Path | DKIM, SPF | aucun si le domaine y est déjà |
| Mise en route | validation du compte | carte bancaire, vérification du domaine | compte | revue manuelle (< 24 h) | sortie de sandbox | aucune |
| SMTP | oui | oui | oui | oui | oui | oui |
| Rejets, journaux | oui | oui (webhook) | oui | oui | oui | non |

Les cases DNS de Mailjet, Postmark et SES n'ont pas été vérifiées sur leur documentation, à la différence de celles de Brevo et Scaleway.

## Ce que ça implique pour nous

- **Passer par SMTP avec Nodemailer**, derrière un port de `application`, garde le choix du fournisseur réversible : un changement de fournisseur se limite aux variables `SMTP_*`. C'est aussi ce qui permet Mailpit en dev et en e2e sans code particulier. Une API HTTP n'a d'intérêt que si le serveur de production bloque les ports SMTP sortants : à tester depuis le VPS (`nc -vz smtp.tem.scaleway.com 587`, ou l'hôte du fournisseur retenu) avant de choisir.
- **Trois candidats sérieux pour une association française** :
  - **Scaleway TEM** si l'on privilégie les données en UE sans exception et le coût à l'usage (quelques centimes par an au-delà de 300 par mois). Point à surveiller : la lenteur possible des premiers envois sur une réputation neuve.
  - **Brevo** si l'on privilégie l'offre gratuite la plus large (300 par jour, de quoi absorber le pic de la convention) et une interface en français. En contrepartie : DMARC obligatoire et une validation du compte.
  - **Le SMTP de la messagerie de l'association** (OVH par exemple), si elle en a déjà une sur le domaine de production : aucun nouveau compte ni nouveau DNS. En revanche, pas de suivi des rejets, et le mot de passe d'une boîte réelle se retrouve dans la configuration.
  - Postmark (données aux États-Unis, 100 par mois en plafond dur) et SES (compte AWS, sandbox) semblent moins adaptés à ce contexte.
- **Décisions à prendre par l'utilisateur** : le domaine d'envoi de production (et l'adresse `From:`, par exemple `ne-pas-repondre@…`) ; qui, dans l'association, détient le compte du fournisseur et l'accès au DNS ; le fournisseur lui-même.
- **DNS, quel que soit le choix** : ajouter le DKIM du fournisseur, intégrer son `include` au SPF unique du domaine, et publier un DMARC en `p=none` avec une adresse de rapport, pour voir passer les échecs avant de durcir.
- **Mailpit dans `docker-compose.yml`**, sur le modèle d'Agilometre (avec `--smtp-disable-rdns`), pour le dev et pour `app-e2e`. Les tests Playwright du bureau récupéreraient le lien magique par l'API REST de Mailpit. Reste à choisir la voie pour le serveur de test et la démo (§6).
- **Configuration** : valider les variables `SMTP_*` au démarrage, pour qu'une erreur de configuration arrête le conteneur au déploiement plutôt qu'à la première demande de lien. Agilometre le fait déjà.
- **Désactiver le suivi des clics** chez le fournisseur retenu, pour que le lien magique ne passe pas par un redirecteur.
- **Points non vérifiés**, à contrôler à l'ouverture du compte : logo ajouté aux emails gratuits (Brevo, Mailjet), délai réel du premier envoi chez Scaleway, et prix exact de l'offre Starter de Brevo.

## Sources

Consultées le 11 novembre 2026.

1. Brevo, « About Brevo's pricing plans », « Free SMTP server », « Free email API for developers » (extraits relevés par moteur de recherche, le site refusant la lecture directe). https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans · https://www.brevo.com/free-smtp-server/ · https://www.brevo.com/features/email-api/
2. Brevo Developers, « API limits ». https://developers.brevo.com/docs/api-limits
3. Brevo, « Authenticate your domain with Brevo (Brevo code, DKIM, DMARC) » et « Connect Brevo SMTP to Supabase ». https://help.brevo.com/hc/en-us/articles/12163873383186-Authenticate-your-domain-with-Brevo-Brevo-code-DKIM-DMARC · https://developers.brevo.com/docs/supabase-smtp-integration
4. Brevo, « Data storage location » et conditions d'utilisation (annexe des sous-traitants). https://help.brevo.com/hc/en-us/articles/360001005510-Data-storage-location · https://www.brevo.com/legal/termsofuse/
5. Scaleway, « Transactional Email FAQ » (validée le 24 septembre 2025), source sur GitHub. https://github.com/scaleway/docs-content/blob/main/pages/transactional-email/faq.mdx · page publiée : https://www.scaleway.com/en/docs/transactional-email/faq/
6. Scaleway, « How to manage TEM plans » et « Concepts » (offre Scale : 100 000 emails, 0,20 € les 1 000 de plus) ; tarifs, extrait de la page officielle (Essential : 300 par organisation, 0,25 €). https://github.com/scaleway/docs-content/blob/main/pages/transactional-email/how-to/manage-tem-plans.mdx · https://github.com/scaleway/docs-content/blob/main/pages/transactional-email/concepts.mdx · https://www.scaleway.com/fr/tarifs/managed-services/
7. Scaleway, « Transactional Email capabilities and limits » (validée le 29 octobre 2025). https://github.com/scaleway/docs-content/blob/main/pages/transactional-email/reference-content/tem-capabilities-and-limits.mdx
8. Scaleway, « I cannot connect to an SMTP server » (5 mai 2026). https://github.com/scaleway/docs-content/blob/main/pages/transactional-email/troubleshooting/smtp-connection.mdx
9. Scaleway, SLA de Transactional Email. https://www.scaleway.com/en/transactional-email-tem/sla/
10. Mailjet, page des tarifs. https://www.mailjet.com/pricing/
11. Mailjet, « Where is my personal data stored? » et page sécurité et confidentialité. https://documentation.mailjet.com/hc/en-us/articles/360042712274-Where-is-my-personal-data-stored · https://www.mailjet.com/de/rechtliches/sicherheit-datenschutz/
12. Postmark, page des tarifs. https://postmarkapp.com/pricing
13. Postmark, « How does the account approval process work? ». https://postmarkapp.com/support/article/1084-how-does-the-account-approval-process-work
14. Postmark, « EU Data Protection », « GDPR FAQ », « Data Processing Addendum ». https://postmarkapp.com/eu-privacy · https://postmarkapp.com/support/article/1218-gdpr-faq · https://postmarkapp.com/dpa
15. AWS, « Amazon SES pricing ». https://aws.amazon.com/ses/pricing/
16. AWS, « Request production access (Moving out of the Amazon SES sandbox) ». https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html
17. Nodemailer, documentation. https://nodemailer.com/
18. OVHcloud, « Hébergement web - Bonnes pratiques d'envoi d'e-mail » (mise à jour du 3 septembre 2026). https://docs.ovhcloud.com/fr/guides/web-cloud/web-hosting/email-sending-best-practices
19. Communauté OVHcloud, « Serveur VPS : port 465 et 587 fermés pour ssl0.ovh.net » et « SMTP server on VPS and port 25 opening » (témoignages, non officiels). https://community.ovhcloud.com/t/serveur-vps-livre-le-07-02-port-465-et-587-ferme-pour-ssl0-ovh-net-ovh-confirme-le-pb-dans-son-infra-et-non-resolu-depuis-le-18-02/409 · https://community.ovhcloud.com/t/smtp-server-on-vps-and-port-25-opening/740
20. RIPE NCC, RDAP de 152.228.233.17 ; enregistrements DNS MX, NS, TXT de `nekbet.fr` et TXT de `_dmarc.nekbet.fr` (via https://dns.google/resolve). https://rdap.db.ripe.net/ip/152.228.233.17
21. Google, « Email sender guidelines ». https://support.google.com/a/answer/81126?hl=en
22. Registre npm (métadonnées des versions citées) et API de téléchargements npm. https://registry.npmjs.org/nodemailer/10.5.0 · https://api.npmjs.org/downloads/point/last-week/nodemailer
23. axllent/mailpit, dépôt et dernière version. https://github.com/axllent/mailpit/releases
24. Mailpit, « Runtime options ». https://mailpit.axllent.org/docs/configuration/runtime-options/
25. Mailpit, description Swagger de l'API v1. https://raw.githubusercontent.com/axllent/mailpit/master/server/ui/api/v1/swagger.json · https://mailpit.axllent.org/docs/api-v1/
26. Mailpit, « Search filters ». https://mailpit.axllent.org/docs/usage/search-filters/
